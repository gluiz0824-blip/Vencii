create type public.payment_method as enum (
  'boleto', 'pix', 'transferencia', 'debito_automatico', 'cartao', 'dinheiro', 'outro'
);

alter table public.organizations
  add column allow_partial_payments boolean not null default false,
  add column allow_overpayments boolean not null default false,
  add column overpayment_tolerance_cents bigint not null default 0,
  add constraint organizations_overpayment_tolerance_check
    check (overpayment_tolerance_cents between 0 and 100000000);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_payable_id uuid not null references public.accounts_payable (id) on delete restrict,
  paid_amount_cents bigint not null,
  paid_at timestamptz not null,
  payment_method public.payment_method not null,
  bank_reference text,
  notes text,
  idempotency_key text not null,
  registered_by uuid not null references auth.users (id) on delete restrict,
  reversed_at timestamptz,
  reversed_by uuid references auth.users (id) on delete restrict,
  reversal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_positive check (paid_amount_cents > 0),
  constraint payments_bank_reference_length check (bank_reference is null or char_length(bank_reference) <= 180),
  constraint payments_notes_length check (notes is null or char_length(notes) <= 1000),
  constraint payments_idempotency_key_length check (char_length(idempotency_key) between 16 and 120),
  constraint payments_reversal_consistency check (
    (reversed_at is null and reversed_by is null and reversal_reason is null)
    or (reversed_at is not null and reversed_by is not null and char_length(reversal_reason) between 3 and 500)
  ),
  unique (organization_id, idempotency_key)
);

create index payments_account_created_idx
  on public.payments (organization_id, account_payable_id, created_at desc);
create index payments_active_account_idx
  on public.payments (account_payable_id) where reversed_at is null;

alter table public.payable_attachments
  add column payment_id uuid references public.payments (id) on delete set null;
create index payable_attachments_payment_idx
  on public.payable_attachments (organization_id, payment_id, created_at desc)
  where payment_id is not null;

alter table public.payments enable row level security;
create policy payments_select_active_member
on public.payments for select to authenticated
using ((select private.is_active_member(organization_id)));
grant select on public.payments to authenticated;

create trigger payments_set_updated_at
before update on public.payments
for each row execute function private.set_updated_at();

create or replace function private.protect_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('vencii.allow_payment_write', true), '') <> 'on' then
      raise exception 'Use o fluxo de registro de pagamento.' using errcode = '42501';
    end if;
    if new.registered_by <> auth.uid() then
      raise exception 'O registrador deve ser o usuário autenticado.' using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if coalesce(current_setting('vencii.allow_payment_reversal', true), '') <> 'on' then
      raise exception 'Pagamentos são imutáveis; use o fluxo de estorno.' using errcode = '42501';
    end if;
    if to_jsonb(new) - array['reversed_at', 'reversed_by', 'reversal_reason', 'updated_at']
      <> to_jsonb(old) - array['reversed_at', 'reversed_by', 'reversal_reason', 'updated_at'] then
      raise exception 'Somente os dados do estorno podem ser alterados.' using errcode = '42501';
    end if;
    if old.reversed_at is not null then
      raise exception 'Este pagamento já foi estornado.' using errcode = 'P0001';
    end if;
  else
    raise exception 'Pagamentos não podem ser excluídos.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.accounts_payable account
    where account.id = new.account_payable_id
      and account.organization_id = new.organization_id
  ) then
    raise exception 'A conta não pertence à organização.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger payments_protect
before insert or update or delete on public.payments
for each row execute function private.protect_payment();
create trigger payments_audit
after insert or update on public.payments
for each row execute function private.write_audit_log();

create or replace function private.protect_payment_attachment_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_id is not null and not exists (
    select 1 from public.payments payment
    where payment.id = new.payment_id
      and payment.organization_id = new.organization_id
      and payment.account_payable_id = new.account_payable_id
  ) then
    raise exception 'O pagamento não pertence à conta e à organização informadas.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger payable_attachments_protect_payment_link
before insert or update of payment_id, account_payable_id on public.payable_attachments
for each row execute function private.protect_payment_attachment_link();

create or replace function private.protect_account_payable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by <> auth.uid() or new.updated_by <> auth.uid() then
      raise exception 'O autor da conta deve ser o usuário autenticado.' using errcode = '42501';
    end if;
    if new.status in ('approved', 'scheduled', 'partial', 'paid', 'rejected')
      and coalesce(current_setting('vencii.allow_approval_decision', true), '') <> 'on'
      and coalesce(current_setting('vencii.allow_payable_payment', true), '') <> 'on'
      and not private.has_organization_role(new.organization_id, array['owner', 'admin']::public.organization_role[], auth.uid()) then
      raise exception 'O papel operator não pode definir estados de decisão ou pagamento.' using errcode = '42501';
    end if;
  else
    if new.organization_id <> old.organization_id or new.created_by <> old.created_by
      or new.idempotency_key <> old.idempotency_key or new.occurrence_index <> old.occurrence_index then
      raise exception 'Organização, autoria e chave idempotente são imutáveis.' using errcode = '42501';
    end if;
    if old.status in ('paid', 'canceled', 'rejected')
      and coalesce(current_setting('vencii.allow_payment_reversal', true), '') <> 'on'
      and (to_jsonb(new) - array['notes', 'updated_by', 'updated_at']
        <> to_jsonb(old) - array['notes', 'updated_by', 'updated_at']) then
      raise exception 'Conta finalizada permite alterar somente observações.' using errcode = '42501';
    end if;
    if old.status = 'partial' and (
      new.amount_cents is distinct from old.amount_cents
      or new.due_date is distinct from old.due_date
      or new.supplier_id is distinct from old.supplier_id
      or new.expense_category_id is distinct from old.expense_category_id
      or new.document_type is distinct from old.document_type
      or new.document_number is distinct from old.document_number
      or new.barcode is distinct from old.barcode
      or new.pix_code is distinct from old.pix_code
    ) then
      raise exception 'Conta com pagamento parcial não permite edição financeira.' using errcode = '42501';
    end if;
    if new.status = 'canceled' and old.status <> 'canceled'
      and coalesce(current_setting('vencii.allow_payable_cancellation', true), '') <> 'on' then
      raise exception 'Use o fluxo de cancelamento com motivo.' using errcode = '42501';
    end if;
    if new.status is distinct from old.status
      and new.status in ('approved', 'scheduled', 'partial', 'paid', 'rejected')
      and coalesce(current_setting('vencii.allow_approval_decision', true), '') <> 'on'
      and coalesce(current_setting('vencii.allow_payable_payment', true), '') <> 'on'
      and coalesce(current_setting('vencii.allow_payment_reversal', true), '') <> 'on'
      and not private.has_organization_role(new.organization_id, array['owner', 'admin']::public.organization_role[], auth.uid()) then
      raise exception 'O papel operator não pode definir estados de decisão ou pagamento.' using errcode = '42501';
    end if;
    if new.updated_by <> auth.uid() then
      raise exception 'O editor deve ser o usuário autenticado.' using errcode = '42501';
    end if;
  end if;
  if new.supplier_id is not null and not exists (
    select 1 from public.suppliers supplier where supplier.id = new.supplier_id and supplier.organization_id = new.organization_id
  ) then raise exception 'Fornecedor não pertence à organização.' using errcode = '23503'; end if;
  if new.expense_category_id is not null and not exists (
    select 1 from public.expense_categories category where category.id = new.expense_category_id and category.organization_id = new.organization_id
  ) then raise exception 'Categoria não pertence à organização.' using errcode = '23503'; end if;
  return new;
end;
$$;

create or replace function private.protect_payable_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status in ('partial', 'paid') and old.status not in ('partial', 'paid')
    and coalesce(current_setting('vencii.allow_payable_payment', true), '') <> 'on' then
    raise exception 'Use o fluxo de registro de pagamento.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.protect_pending_approval_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('partial', 'paid') and old.status not in ('partial', 'paid') and exists (
    select 1 from public.payable_approval_requests request
    where request.account_payable_id = new.id and request.status = 'pending'
  ) then
    raise exception 'A conta precisa ser aprovada antes do registro de pagamento.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function private.protect_paid_account_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status in ('partial', 'paid') or exists (
    select 1 from public.payments payment where payment.account_payable_id = old.id
  ) then
    raise exception 'Conta com pagamento não pode ser excluída.' using errcode = '42501';
  end if;
  return old;
end;
$$;
create trigger accounts_payable_protect_paid_delete
before delete on public.accounts_payable
for each row execute function private.protect_paid_account_delete();

create or replace function public.register_account_payment(
  p_organization_id uuid,
  p_account_id uuid,
  p_paid_amount_cents bigint,
  p_paid_at timestamptz,
  p_payment_method public.payment_method,
  p_bank_reference text default null,
  p_notes text default null,
  p_idempotency_key text default null,
  p_confirm_overpayment boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  account_record public.accounts_payable%rowtype;
  organization_record public.organizations%rowtype;
  active_total bigint;
  remaining bigint;
  payment_id uuid;
  final_status public.payable_status;
begin
  if current_user_id is null or not private.has_organization_role(
    p_organization_id, array['owner', 'admin']::public.organization_role[], current_user_id
  ) then raise exception 'Somente owner ou admin pode registrar um pagamento.' using errcode = '42501'; end if;
  if p_paid_amount_cents is null or p_paid_amount_cents <= 0 then
    raise exception 'Informe um valor de pagamento válido.' using errcode = '22023'; end if;
  if p_paid_at is null or p_payment_method is null then
    raise exception 'Informe data e método do pagamento.' using errcode = '22023'; end if;
  if char_length(coalesce(p_idempotency_key, '')) not between 16 and 120 then
    raise exception 'Chave idempotente inválida.' using errcode = '22023'; end if;
  if char_length(coalesce(p_bank_reference, '')) > 180 or char_length(coalesce(p_notes, '')) > 1000 then
    raise exception 'Referência ou observação excede o limite permitido.' using errcode = '22023'; end if;

  select id into payment_id from public.payments
  where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if found then return payment_id; end if;

  select * into organization_record from public.organizations
  where id = p_organization_id;
  if not found then raise exception 'Organização não encontrada.' using errcode = 'P0002'; end if;
  if p_paid_at > now() + interval '5 minutes' then
    raise exception 'A data do pagamento não pode estar no futuro.' using errcode = '22023'; end if;

  select * into account_record from public.accounts_payable
  where id = p_account_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Conta não encontrada.' using errcode = 'P0002'; end if;
  if account_record.status in ('draft', 'canceled', 'rejected') then
    raise exception 'Esta conta não pode receber pagamento no estado atual.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.payable_approval_requests request where request.account_payable_id = p_account_id)
    and not exists (select 1 from public.payable_approval_requests request where request.account_payable_id = p_account_id and request.status = 'approved') then
    raise exception 'A conta precisa ser aprovada antes do registro de pagamento.' using errcode = 'P0001'; end if;

  select coalesce(sum(payment.paid_amount_cents), 0) into active_total
  from public.payments payment
  where payment.account_payable_id = p_account_id and payment.reversed_at is null;
  remaining := greatest(account_record.amount_cents - active_total, 0);
  if remaining = 0 then raise exception 'Esta conta já está totalmente paga.' using errcode = 'P0001'; end if;
  if p_paid_amount_cents < remaining and not organization_record.allow_partial_payments then
    raise exception 'Pagamentos parciais não estão habilitados para esta organização.' using errcode = 'P0001'; end if;
  if p_paid_amount_cents > remaining and (
    not p_confirm_overpayment or not organization_record.allow_overpayments
    or p_paid_amount_cents - remaining > organization_record.overpayment_tolerance_cents
  ) then raise exception 'O valor informado é maior que o saldo restante.' using errcode = 'P0001'; end if;

  perform set_config('vencii.allow_payment_write', 'on', true);
  insert into public.payments (
    organization_id, account_payable_id, paid_amount_cents, paid_at, payment_method,
    bank_reference, notes, idempotency_key, registered_by
  ) values (
    p_organization_id, p_account_id, p_paid_amount_cents, p_paid_at, p_payment_method,
    nullif(trim(coalesce(p_bank_reference, '')), ''), nullif(trim(coalesce(p_notes, '')), ''),
    p_idempotency_key, current_user_id
  ) returning id into payment_id;

  active_total := active_total + p_paid_amount_cents;
  final_status := case when active_total >= account_record.amount_cents then 'paid' else 'partial' end;
  perform set_config('vencii.allow_payable_payment', 'on', true);
  update public.accounts_payable
  set status = final_status,
      paid_date = case when final_status = 'paid' then (p_paid_at at time zone organization_record.timezone)::date else null end,
      payment_notes = case when final_status = 'paid' then nullif(trim(coalesce(p_notes, '')), '') else null end,
      updated_by = current_user_id
  where id = p_account_id;
  return payment_id;
end;
$$;

create or replace function public.reverse_account_payment(
  p_organization_id uuid,
  p_payment_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  payment_record public.payments%rowtype;
  account_record public.accounts_payable%rowtype;
  active_total bigint;
  business_today date;
  restored_status public.payable_status;
begin
  if current_user_id is null or not private.has_organization_role(
    p_organization_id, array['owner', 'admin']::public.organization_role[], current_user_id
  ) then raise exception 'Somente owner ou admin pode estornar um pagamento.' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'Informe um motivo de estorno entre 3 e 500 caracteres.' using errcode = '22023'; end if;

  select * into payment_record from public.payments
  where id = p_payment_id and organization_id = p_organization_id;
  if not found then raise exception 'Pagamento não encontrado.' using errcode = 'P0002'; end if;
  select * into account_record from public.accounts_payable
  where id = payment_record.account_payable_id for update;
  select * into payment_record from public.payments
  where id = p_payment_id and organization_id = p_organization_id for update;
  if payment_record.reversed_at is not null then return; end if;

  perform set_config('vencii.allow_payment_reversal', 'on', true);
  update public.payments set reversed_at = now(), reversed_by = current_user_id,
    reversal_reason = trim(p_reason) where id = p_payment_id;
  select coalesce(sum(payment.paid_amount_cents), 0) into active_total
  from public.payments payment
  where payment.account_payable_id = account_record.id and payment.reversed_at is null;
  select (now() at time zone organization.timezone)::date into business_today
  from public.organizations organization where organization.id = p_organization_id;
  restored_status := case
    when active_total >= account_record.amount_cents then 'paid'
    when active_total > 0 then 'partial'
    when exists (select 1 from public.payable_approval_requests request where request.account_payable_id = account_record.id and request.status = 'approved') then 'approved'
    when account_record.due_date < business_today then 'overdue'
    else 'pending'
  end;
  perform set_config('vencii.allow_payable_payment', 'on', true);
  update public.accounts_payable set status = restored_status,
    paid_date = case when restored_status = 'paid' then paid_date else null end,
    payment_notes = case when restored_status = 'paid' then payment_notes else null end,
    updated_by = current_user_id where id = account_record.id;
end;
$$;

create or replace function public.mark_account_payable_paid(
  p_organization_id uuid, p_account_id uuid, p_paid_date date, p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_amount bigint;
  already_paid bigint;
  organization_timezone text;
  account_status public.payable_status;
begin
  select amount_cents, status into account_amount, account_status from public.accounts_payable
  where id = p_account_id and organization_id = p_organization_id;
  if not found then raise exception 'Conta não encontrada.' using errcode = 'P0002'; end if;
  if account_status = 'paid' then return; end if;
  select coalesce(sum(paid_amount_cents), 0) into already_paid from public.payments
  where account_payable_id = p_account_id and reversed_at is null;
  if already_paid >= account_amount then return; end if;
  select timezone into organization_timezone from public.organizations
  where id = p_organization_id;
  perform public.register_account_payment(
    p_organization_id, p_account_id, account_amount - already_paid,
    p_paid_date::timestamp at time zone organization_timezone, 'outro', null, p_notes,
    'legacy:' || p_account_id::text || ':' || p_paid_date::text, false
  );
end;
$$;

create or replace function private.active_payment_total(p_account_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(payment.paid_amount_cents), 0)::bigint
  from public.payments payment
  where payment.account_payable_id = p_account_id and payment.reversed_at is null;
$$;

create or replace function public.cancel_account_payable(
  p_organization_id uuid, p_account_id uuid, p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare current_user_id uuid := auth.uid(); current_status public.payable_status;
begin
  if current_user_id is null or not private.has_organization_role(
    p_organization_id, array['owner', 'admin', 'operator']::public.organization_role[], current_user_id
  ) then raise exception 'Sem permissão para cancelar esta conta.' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'Informe um motivo de cancelamento entre 3 e 500 caracteres.' using errcode = '22023'; end if;
  select status into current_status from public.accounts_payable
  where id = p_account_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Conta não encontrada.' using errcode = 'P0002'; end if;
  if current_status in ('partial', 'paid', 'canceled', 'rejected') then
    raise exception 'Esta conta não pode ser cancelada no estado atual.' using errcode = 'P0001'; end if;
  perform set_config('vencii.allow_payable_cancellation', 'on', true);
  update public.accounts_payable set status = 'canceled', cancellation_reason = trim(p_reason),
    updated_by = current_user_id where id = p_account_id;
end;
$$;

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
declare result jsonb;
begin
  if auth.uid() is null or not private.is_active_member(p_organization_id, auth.uid()) then
    raise exception 'Organização não autorizada.' using errcode = '42501';
  end if;
  with balances as (
    select account.*,
      greatest(account.amount_cents - private.active_payment_total(account.id), 0)::bigint as balance_cents
    from public.accounts_payable account where account.organization_id = p_organization_id
  ), realized as (
    select (
      select coalesce(sum(payment.paid_amount_cents), 0)::bigint
      from public.payments payment
      join public.organizations organization on organization.id = payment.organization_id
      where payment.organization_id = p_organization_id and payment.reversed_at is null
        and (payment.paid_at at time zone organization.timezone)::date >= date_trunc('month', p_business_date)::date
        and (payment.paid_at at time zone organization.timezone)::date < (date_trunc('month', p_business_date) + interval '1 month')::date
    ) + (
      select coalesce(sum(account.amount_cents), 0)::bigint
      from public.accounts_payable account
      where account.organization_id = p_organization_id and account.status = 'paid'
        and account.paid_date >= date_trunc('month', p_business_date)::date
        and account.paid_date < (date_trunc('month', p_business_date) + interval '1 month')::date
        and not exists (select 1 from public.payments payment where payment.account_payable_id = account.id)
    ) as total
  )
  select jsonb_build_object(
    'totalCount', count(*),
    'dueTodayCents', coalesce(sum(balance_cents) filter (where due_date = p_business_date and status in ('pending', 'awaiting_approval', 'approved', 'scheduled', 'partial', 'overdue')), 0),
    'dueNext7DaysCents', coalesce(sum(balance_cents) filter (where due_date > p_business_date and due_date <= p_business_date + 7 and status in ('pending', 'awaiting_approval', 'approved', 'scheduled', 'partial')), 0),
    'dueNext30DaysCents', coalesce(sum(balance_cents) filter (where due_date > p_business_date and due_date <= p_business_date + 30 and status in ('pending', 'awaiting_approval', 'approved', 'scheduled', 'partial')), 0),
    'overdueCents', coalesce(sum(balance_cents) filter (where due_date < p_business_date and status in ('pending', 'awaiting_approval', 'approved', 'scheduled', 'partial', 'overdue')), 0),
    'awaitingApprovalCents', coalesce(sum(balance_cents) filter (where status = 'awaiting_approval'), 0),
    'paidThisMonthCents', (select total from realized)
  ) into result from balances;
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
declare result jsonb;
begin
  if auth.uid() is null or not private.is_active_member(p_organization_id, auth.uid()) then
    raise exception 'Organização não autorizada.' using errcode = '42501';
  end if;
  with weeks as (
    select generate_series(date_trunc('week', p_business_date::timestamp)::date, date_trunc('week', p_business_date::timestamp)::date + 77, interval '7 days')::date as week_start
  ), totals as (
    select date_trunc('week', account.due_date::timestamp)::date as week_start,
      sum(greatest(account.amount_cents - private.active_payment_total(account.id), 0))::bigint as total_cents
    from public.accounts_payable account
    where account.organization_id = p_organization_id and account.due_date between p_business_date and p_business_date + 83
      and account.status in ('pending', 'awaiting_approval', 'approved', 'scheduled', 'partial')
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object('periodStart', weeks.week_start, 'totalCents', coalesce(totals.total_cents, 0)) order by weeks.week_start), '[]'::jsonb)
  into result from weeks left join totals using (week_start);
  return result;
end;
$$;

create or replace function public.get_financial_distributions(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null or not private.is_active_member(p_organization_id, auth.uid()) then
    raise exception 'Organização não autorizada.' using errcode = '42501';
  end if;
  with category_totals as (
    select coalesce(category.name, 'Sem categoria') as label,
      sum(greatest(account.amount_cents - private.active_payment_total(account.id), 0))::bigint as total_cents
    from public.accounts_payable account left join public.expense_categories category on category.id = account.expense_category_id
    where account.organization_id = p_organization_id and account.status in ('pending', 'awaiting_approval', 'approved', 'scheduled', 'partial', 'overdue')
    group by 1 order by 2 desc limit 6
  ), supplier_totals as (
    select coalesce(supplier.name, 'Sem fornecedor') as label,
      sum(greatest(account.amount_cents - private.active_payment_total(account.id), 0))::bigint as total_cents
    from public.accounts_payable account left join public.suppliers supplier on supplier.id = account.supplier_id
    where account.organization_id = p_organization_id and account.status in ('pending', 'awaiting_approval', 'approved', 'scheduled', 'partial', 'overdue')
    group by 1 order by 2 desc limit 6
  )
  select jsonb_build_object(
    'categories', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'totalCents', total_cents) order by total_cents desc) from category_totals), '[]'::jsonb),
    'suppliers', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'totalCents', total_cents) order by total_cents desc) from supplier_totals), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.get_payables_calendar(
  p_organization_id uuid, p_date_from date, p_date_to date,
  p_status public.payable_status default null, p_supplier_id uuid default null, p_category_id uuid default null
)
returns table (due_date date, account_count bigint, total_cents bigint, accounts jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_active_member(p_organization_id, auth.uid()) then raise exception 'Organização não autorizada.' using errcode = '42501'; end if;
  if p_date_to < p_date_from or p_date_to > p_date_from + 62 then raise exception 'Período de calendário inválido.' using errcode = '22023'; end if;
  return query
  select account.due_date, count(*)::bigint,
    sum(case when account.status = 'paid' then account.amount_cents else greatest(account.amount_cents - private.active_payment_total(account.id), 0) end)::bigint,
    jsonb_agg(jsonb_build_object(
      'id', account.id, 'description', account.description,
      'amountCents', case when account.status = 'paid' then account.amount_cents else greatest(account.amount_cents - private.active_payment_total(account.id), 0) end,
      'status', account.status, 'supplierName', supplier.name, 'categoryName', category.name
    ) order by account.amount_cents desc, account.id)
  from public.accounts_payable account
  left join public.suppliers supplier on supplier.id = account.supplier_id
  left join public.expense_categories category on category.id = account.expense_category_id
  where account.organization_id = p_organization_id and account.due_date between p_date_from and p_date_to
    and account.status not in ('canceled', 'rejected') and (p_status is null or account.status = p_status)
    and (p_supplier_id is null or account.supplier_id = p_supplier_id)
    and (p_category_id is null or account.expense_category_id = p_category_id)
  group by account.due_date order by account.due_date;
end;
$$;

revoke all on function public.register_account_payment(uuid, uuid, bigint, timestamptz, public.payment_method, text, text, text, boolean) from public, anon;
revoke all on function public.reverse_account_payment(uuid, uuid, text) from public, anon;
grant execute on function public.register_account_payment(uuid, uuid, bigint, timestamptz, public.payment_method, text, text, text, boolean) to authenticated;
grant execute on function public.reverse_account_payment(uuid, uuid, text) to authenticated;
