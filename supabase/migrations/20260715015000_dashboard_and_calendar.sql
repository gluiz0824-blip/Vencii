create index accounts_payable_paid_date_idx
  on public.accounts_payable (organization_id, paid_date)
  where status = 'paid';

create or replace function public.get_financial_dashboard_summary(
  p_organization_id uuid,
  p_business_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not private.is_active_member(p_organization_id, auth.uid()) then
    raise exception 'Organização não autorizada.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'totalCount', count(*),
    'dueTodayCents', coalesce(sum(amount_cents) filter (
      where due_date = p_business_date
        and status in ('pending', 'awaiting_approval', 'approved', 'scheduled', 'overdue')
    ), 0),
    'dueNext7DaysCents', coalesce(sum(amount_cents) filter (
      where due_date > p_business_date and due_date <= p_business_date + 7
        and status in ('pending', 'awaiting_approval', 'approved', 'scheduled')
    ), 0),
    'dueNext30DaysCents', coalesce(sum(amount_cents) filter (
      where due_date > p_business_date and due_date <= p_business_date + 30
        and status in ('pending', 'awaiting_approval', 'approved', 'scheduled')
    ), 0),
    'overdueCents', coalesce(sum(amount_cents) filter (
      where due_date < p_business_date
        and status in ('pending', 'awaiting_approval', 'approved', 'scheduled', 'overdue')
    ), 0),
    'awaitingApprovalCents', coalesce(sum(amount_cents) filter (
      where status = 'awaiting_approval'
    ), 0),
    'paidThisMonthCents', coalesce(sum(amount_cents) filter (
      where status = 'paid'
        and paid_date >= date_trunc('month', p_business_date)::date
        and paid_date < (date_trunc('month', p_business_date) + interval '1 month')::date
    ), 0)
  ) into result
  from public.accounts_payable
  where organization_id = p_organization_id;

  return result;
end;
$$;

create or replace function public.get_financial_forecast(
  p_organization_id uuid,
  p_business_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not private.is_active_member(p_organization_id, auth.uid()) then
    raise exception 'Organização não autorizada.' using errcode = '42501';
  end if;

  with weeks as (
    select generate_series(
      date_trunc('week', p_business_date::timestamp)::date,
      date_trunc('week', p_business_date::timestamp)::date + 77,
      interval '7 days'
    )::date as week_start
  ), totals as (
    select date_trunc('week', due_date::timestamp)::date as week_start,
           sum(amount_cents)::bigint as total_cents
    from public.accounts_payable
    where organization_id = p_organization_id
      and due_date >= p_business_date
      and due_date <= p_business_date + 83
      and status in ('pending', 'awaiting_approval', 'approved', 'scheduled')
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'periodStart', weeks.week_start,
    'totalCents', coalesce(totals.total_cents, 0)
  ) order by weeks.week_start), '[]'::jsonb)
  into result
  from weeks left join totals using (week_start);

  return result;
end;
$$;

create or replace function public.get_financial_distributions(
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not private.is_active_member(p_organization_id, auth.uid()) then
    raise exception 'Organização não autorizada.' using errcode = '42501';
  end if;

  with category_totals as (
    select coalesce(category.name, 'Sem categoria') as label,
           sum(account.amount_cents)::bigint as total_cents
    from public.accounts_payable account
    left join public.expense_categories category on category.id = account.expense_category_id
    where account.organization_id = p_organization_id
      and account.status in ('pending', 'awaiting_approval', 'approved', 'scheduled', 'overdue')
    group by 1 order by 2 desc limit 6
  ), supplier_totals as (
    select coalesce(supplier.name, 'Sem fornecedor') as label,
           sum(account.amount_cents)::bigint as total_cents
    from public.accounts_payable account
    left join public.suppliers supplier on supplier.id = account.supplier_id
    where account.organization_id = p_organization_id
      and account.status in ('pending', 'awaiting_approval', 'approved', 'scheduled', 'overdue')
    group by 1 order by 2 desc limit 6
  )
  select jsonb_build_object(
    'categories', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'totalCents', total_cents) order by total_cents desc) from category_totals), '[]'::jsonb),
    'suppliers', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'totalCents', total_cents) order by total_cents desc) from supplier_totals), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.get_financial_alerts(
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not private.is_active_member(p_organization_id, auth.uid()) then
    raise exception 'Organização não autorizada.' using errcode = '42501';
  end if;

  with duplicate_groups as (
    select barcode as identity
    from public.accounts_payable
    where organization_id = p_organization_id and barcode is not null and status <> 'canceled'
    group by barcode having count(*) > 1
    union
    select concat_ws('|', supplier_id::text, amount_cents::text, due_date::text)
    from public.accounts_payable
    where organization_id = p_organization_id and supplier_id is not null and status <> 'canceled'
    group by supplier_id, amount_cents, due_date having count(*) > 1
  )
  select jsonb_build_object(
    'possibleDuplicates', (select count(*) from duplicate_groups),
    'documentsNeedsReview', (
      select count(*) from public.payable_attachments
      where organization_id = p_organization_id and extraction_status = 'needs_review'
    ),
    'documentsFailed', (
      select count(*) from public.payable_attachments
      where organization_id = p_organization_id and extraction_status = 'failed'
    )
  ) into result;

  return result;
end;
$$;

create or replace function public.get_payables_calendar(
  p_organization_id uuid,
  p_date_from date,
  p_date_to date,
  p_status public.payable_status default null,
  p_supplier_id uuid default null,
  p_category_id uuid default null
)
returns table (
  due_date date,
  account_count bigint,
  total_cents bigint,
  accounts jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_active_member(p_organization_id, auth.uid()) then
    raise exception 'Organização não autorizada.' using errcode = '42501';
  end if;
  if p_date_to < p_date_from or p_date_to > p_date_from + 62 then
    raise exception 'Período de calendário inválido.' using errcode = '22023';
  end if;

  return query
  select account.due_date,
         count(*)::bigint,
         sum(account.amount_cents)::bigint,
         jsonb_agg(jsonb_build_object(
           'id', account.id,
           'description', account.description,
           'amountCents', account.amount_cents,
           'status', account.status,
           'supplierName', supplier.name,
           'categoryName', category.name
         ) order by account.amount_cents desc, account.id)
  from public.accounts_payable account
  left join public.suppliers supplier on supplier.id = account.supplier_id
  left join public.expense_categories category on category.id = account.expense_category_id
  where account.organization_id = p_organization_id
    and account.due_date between p_date_from and p_date_to
    and account.status not in ('canceled', 'rejected')
    and (p_status is null or account.status = p_status)
    and (p_supplier_id is null or account.supplier_id = p_supplier_id)
    and (p_category_id is null or account.expense_category_id = p_category_id)
  group by account.due_date
  order by account.due_date;
end;
$$;

revoke all on function public.get_financial_dashboard_summary(uuid, date) from public, anon;
revoke all on function public.get_financial_forecast(uuid, date) from public, anon;
revoke all on function public.get_financial_distributions(uuid) from public, anon;
revoke all on function public.get_financial_alerts(uuid) from public, anon;
revoke all on function public.get_payables_calendar(uuid, date, date, public.payable_status, uuid, uuid) from public, anon;
grant execute on function public.get_financial_dashboard_summary(uuid, date) to authenticated;
grant execute on function public.get_financial_forecast(uuid, date) to authenticated;
grant execute on function public.get_financial_distributions(uuid) to authenticated;
grant execute on function public.get_financial_alerts(uuid) to authenticated;
grant execute on function public.get_payables_calendar(uuid, date, date, public.payable_status, uuid, uuid) to authenticated;
