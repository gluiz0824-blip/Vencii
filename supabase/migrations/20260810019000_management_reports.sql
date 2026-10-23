create type public.report_kind as enum (
  'forecast', 'paid', 'overdue', 'supplier', 'category', 'variance', 'approvals', 'payments'
);
create type public.report_export_format as enum ('csv', 'pdf');
create type public.report_export_status as enum ('pending', 'processing', 'completed', 'failed', 'expired');
alter type public.notification_type add value if not exists 'report_export_ready';

create table public.report_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  report_kind public.report_kind not null,
  format public.report_export_format not null,
  filters jsonb not null default '{}'::jsonb,
  status public.report_export_status not null default 'pending',
  storage_path text unique,
  size_bytes bigint,
  row_count integer,
  error_message text,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint report_exports_filters_object check (jsonb_typeof(filters)='object' and octet_length(filters::text)<=8192),
  constraint report_exports_storage_consistency check (
    (status='completed' and storage_path is not null and size_bytes is not null and row_count is not null and completed_at is not null)
    or status<>'completed'
  ),
  constraint report_exports_error_length check (error_message is null or char_length(error_message)<=500)
);
create index report_exports_queue_idx on public.report_exports(status, created_at) where status in ('pending','processing');
create index report_exports_user_idx on public.report_exports(organization_id, requested_by, created_at desc);
alter table public.report_exports enable row level security;
create policy report_exports_select_requester on public.report_exports for select to authenticated
using (requested_by=auth.uid() and private.is_active_member(organization_id));
grant select on public.report_exports to authenticated;
grant select, insert, update on public.report_exports to service_role;
create trigger report_exports_set_updated_at before update on public.report_exports
for each row execute function private.set_updated_at();
create trigger report_exports_audit after insert or update on public.report_exports
for each row execute function private.write_audit_log();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('report-exports','report-exports',false,52428800,array['text/csv','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy report_exports_storage_select on storage.objects for select to authenticated
using (bucket_id='report-exports' and exists (
  select 1 from public.report_exports export where export.storage_path=name
    and export.requested_by=auth.uid() and export.status='completed'
    and export.expires_at>now() and private.is_active_member(export.organization_id)
));

create or replace function public.get_management_report(
  p_organization_id uuid, p_date_from date, p_date_to date,
  p_report_kind public.report_kind default 'forecast',
  p_business_date date default current_date,
  p_status public.payable_status default null,
  p_supplier_id uuid default null, p_category_id uuid default null,
  p_payment_method public.payment_method default null,
  p_responsible_user_id uuid default null,
  p_page integer default 1, p_page_size integer default 25,
  p_actor_user_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb; actor_id uuid;
begin
  actor_id := case when auth.role()='service_role' then p_actor_user_id else auth.uid() end;
  if actor_id is null or not private.is_active_member(p_organization_id, actor_id) then
    raise exception 'Organização não autorizada.' using errcode='42501';
  end if;
  if p_date_to<p_date_from or p_date_to>p_date_from+1826 then
    raise exception 'Período de relatório inválido.' using errcode='22023';
  end if;
  if p_page<1 or p_page_size<1 or p_page_size>5000 then
    raise exception 'Paginação inválida.' using errcode='22023';
  end if;

  with account_payments as (
    select payment.account_payable_id,
      coalesce(sum(payment.paid_amount_cents) filter(where payment.reversed_at is null),0)::bigint active_paid_cents
    from public.payments payment where payment.organization_id=p_organization_id group by payment.account_payable_id
  ), filtered_accounts as (
    select account.*, coalesce(supplier.name,'Sem fornecedor') supplier_name,
      coalesce(category.name,'Sem categoria') category_name,
      coalesce(profile.full_name,'Usuário não identificado') responsible_name,
      greatest(account.amount_cents-coalesce(account_payments.active_paid_cents,0),0)::bigint balance_cents
    from public.accounts_payable account
    left join public.suppliers supplier on supplier.id=account.supplier_id
    left join public.expense_categories category on category.id=account.expense_category_id
    left join public.profiles profile on profile.id=account.created_by
    left join account_payments on account_payments.account_payable_id=account.id
    where account.organization_id=p_organization_id
      and account.due_date between p_date_from and p_date_to
      and (p_status is not null and account.status=p_status or p_status is null and account.status not in ('canceled','rejected'))
      and (p_supplier_id is null or account.supplier_id=p_supplier_id)
      and (p_category_id is null or account.expense_category_id=p_category_id)
      and (p_responsible_user_id is null or account.created_by=p_responsible_user_id)
      and (p_payment_method is null or exists(select 1 from public.payments payment where payment.account_payable_id=account.id and payment.payment_method=p_payment_method and payment.reversed_at is null))
      and (p_report_kind<>'overdue' or (account.due_date<p_business_date and greatest(account.amount_cents-coalesce(account_payments.active_paid_cents,0),0)>0))
  ), filtered_payments as (
    select payment.*, account.description, account.due_date, account.status account_status,
      coalesce(supplier.name,'Sem fornecedor') supplier_name,
      coalesce(category.name,'Sem categoria') category_name,
      coalesce(profile.full_name,'Usuário não identificado') responsible_name,
      (payment.paid_at at time zone organization.timezone)::date payment_date
    from public.payments payment
    join public.organizations organization on organization.id=payment.organization_id
    join public.accounts_payable account on account.id=payment.account_payable_id
    left join public.suppliers supplier on supplier.id=account.supplier_id
    left join public.expense_categories category on category.id=account.expense_category_id
    left join public.profiles profile on profile.id=payment.registered_by
    where payment.organization_id=p_organization_id
      and (payment.paid_at at time zone organization.timezone)::date between p_date_from and p_date_to
      and (p_report_kind='payments' or payment.reversed_at is null)
      and (p_status is null or account.status=p_status)
      and (p_supplier_id is null or account.supplier_id=p_supplier_id)
      and (p_category_id is null or account.expense_category_id=p_category_id)
      and (p_payment_method is null or payment.payment_method=p_payment_method)
      and (p_responsible_user_id is null or payment.registered_by=p_responsible_user_id)
  ), summary as (
    select
      coalesce((select sum(amount_cents) from filtered_accounts),0)::bigint predicted_cents,
      coalesce((select sum(paid_amount_cents) from filtered_payments where reversed_at is null),0)::bigint realized_cents,
      coalesce((select sum(balance_cents) from filtered_accounts where due_date<p_business_date),0)::bigint overdue_cents,
      coalesce((select sum(paid_amount_cents) from filtered_payments where reversed_at is not null),0)::bigint reversed_cents,
      (select count(*) from filtered_payments where reversed_at is not null)::bigint reversed_count,
      coalesce((select avg(extract(epoch from (request.completed_at-request.requested_at))/3600.0)
        from public.payable_approval_requests request join filtered_accounts account on account.id=request.account_payable_id
        where request.completed_at is not null),0)::numeric average_approval_hours
  ), category_totals as (
    select category_name label,sum(amount_cents)::bigint total_cents from filtered_accounts group by category_name order by 2 desc limit 8
  ), supplier_totals as (
    select supplier_name label,sum(amount_cents)::bigint total_cents from filtered_accounts group by supplier_name order by 2 desc limit 8
  ), account_rows as (
    select account.id::text id,'account'::text row_type,account.due_date event_date,account.description,
      account.supplier_name,account.category_name,account.amount_cents::bigint amount_cents,
      account.balance_cents,account.status::text status,null::text payment_method,
      account.responsible_name,null::timestamptz reversed_at,null::text reversal_reason
    from filtered_accounts account
  ), payment_rows as (
    select payment.id::text id,'payment'::text row_type,payment.payment_date event_date,payment.description,
      payment.supplier_name,payment.category_name,payment.paid_amount_cents::bigint amount_cents,
      0::bigint balance_cents,case when payment.reversed_at is null then 'active' else 'reversed' end status,
      payment.payment_method::text,payment.responsible_name,payment.reversed_at,payment.reversal_reason
    from filtered_payments payment
  ), selected_rows as (
    select * from payment_rows where p_report_kind in ('paid','payments')
    union all select * from account_rows where p_report_kind not in ('paid','payments')
  ), paged_rows as (
    select * from selected_rows order by event_date desc,id limit p_page_size offset ((p_page-1)*p_page_size)
  )
  select jsonb_build_object(
    'summary',jsonb_build_object(
      'predictedCents',summary.predicted_cents,'realizedCents',summary.realized_cents,
      'varianceCents',summary.predicted_cents-summary.realized_cents,'overdueCents',summary.overdue_cents,
      'averageApprovalHours',round(summary.average_approval_hours,1),
      'reversedCents',summary.reversed_cents,'reversedCount',summary.reversed_count,
      'totalCount',(select count(*) from selected_rows)
    ),
    'categories',coalesce((select jsonb_agg(jsonb_build_object('label',label,'totalCents',total_cents) order by total_cents desc) from category_totals),'[]'::jsonb),
    'suppliers',coalesce((select jsonb_agg(jsonb_build_object('label',label,'totalCents',total_cents) order by total_cents desc) from supplier_totals),'[]'::jsonb),
    'rows',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'rowType',row_type,'eventDate',event_date,'description',description,
      'supplierName',supplier_name,'categoryName',category_name,'amountCents',amount_cents,
      'balanceCents',balance_cents,'status',status,'paymentMethod',payment_method,
      'responsibleName',responsible_name,'reversedAt',reversed_at,'reversalReason',reversal_reason
    ) order by event_date desc,id) from paged_rows),'[]'::jsonb)
  ) into result from summary;
  return result;
end;
$$;

create or replace function public.enqueue_report_export(
  p_organization_id uuid,p_report_kind public.report_kind,p_format public.report_export_format,p_filters jsonb
) returns uuid language plpgsql security definer set search_path=''
as $$ declare export_id uuid;
begin
  if auth.uid() is null or not private.is_active_member(p_organization_id,auth.uid()) then raise exception 'Organização não autorizada.' using errcode='42501'; end if;
  insert into public.report_exports(organization_id,requested_by,report_kind,format,filters)
  values(p_organization_id,auth.uid(),p_report_kind,p_format,p_filters) returning id into export_id;
  return export_id;
end $$;

create or replace function public.record_immediate_report_export(
  p_organization_id uuid,p_report_kind public.report_kind,p_format public.report_export_format,p_filters jsonb,p_row_count integer
) returns void language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null or not private.is_active_member(p_organization_id,auth.uid()) then raise exception 'Organização não autorizada.' using errcode='42501'; end if;
  insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,after_data)
  values(p_organization_id,auth.uid(),'EXPORT','management_report',jsonb_build_object('reportKind',p_report_kind,'format',p_format,'filters',p_filters,'rowCount',p_row_count));
end $$;

create or replace function public.claim_report_exports(p_limit integer default 5)
returns table(id uuid,organization_id uuid,requested_by uuid,report_kind public.report_kind,format public.report_export_format,filters jsonb)
language plpgsql security definer set search_path=''
as $$ begin
  if auth.role()<>'service_role' then raise exception 'Acesso restrito ao processador.' using errcode='42501'; end if;
  return query with claimed as (
    select export.id from public.report_exports export where export.status='pending' and export.expires_at>now()
    order by export.created_at for update skip locked limit least(greatest(p_limit,1),20)
  ) update public.report_exports export set status='processing' from claimed where export.id=claimed.id
  returning export.id,export.organization_id,export.requested_by,export.report_kind,export.format,export.filters;
end $$;

create or replace function public.finish_report_export(
  p_export_id uuid,p_success boolean,p_storage_path text default null,p_size_bytes bigint default null,p_row_count integer default null,p_error text default null
) returns void language plpgsql security definer set search_path=''
as $$ declare export_record public.report_exports%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Acesso restrito ao processador.' using errcode='42501'; end if;
  update public.report_exports set status=case when p_success then 'completed' else 'failed' end,
    storage_path=case when p_success then p_storage_path else null end,size_bytes=case when p_success then p_size_bytes else null end,
    row_count=case when p_success then p_row_count else null end,error_message=case when p_success then null else left(coalesce(p_error,'Falha na exportação.'),500) end,
    completed_at=case when p_success then now() else null end where id=p_export_id and status='processing' returning * into export_record;
  if export_record.id is null then raise exception 'Exportação não está em processamento.' using errcode='P0001'; end if;
  if p_success then insert into public.notifications(organization_id,user_id,type,title,body,entity_type,entity_id,dedupe_key)
    values(export_record.organization_id,export_record.requested_by,'report_export_ready','Relatório pronto para baixar','Sua exportação foi concluída e ficará disponível por 24 horas.','report_exports',export_record.id,'report-export:'||export_record.id) on conflict do nothing; end if;
end $$;

create or replace function public.expire_report_exports()
returns setof text language plpgsql security definer set search_path=''
as $$ begin
  if auth.role()<>'service_role' then raise exception 'Acesso restrito ao processador.' using errcode='42501'; end if;
  return query update public.report_exports set status='expired'
    where expires_at<=now() and status='completed' returning storage_path;
end $$;

revoke all on function public.get_management_report(uuid,date,date,public.report_kind,date,public.payable_status,uuid,uuid,public.payment_method,uuid,integer,integer,uuid) from public,anon;
revoke all on function public.enqueue_report_export(uuid,public.report_kind,public.report_export_format,jsonb) from public,anon;
revoke all on function public.record_immediate_report_export(uuid,public.report_kind,public.report_export_format,jsonb,integer) from public,anon;
revoke all on function public.claim_report_exports(integer) from public,anon,authenticated;
revoke all on function public.finish_report_export(uuid,boolean,text,bigint,integer,text) from public,anon,authenticated;
revoke all on function public.expire_report_exports() from public,anon,authenticated;
grant execute on function public.get_management_report(uuid,date,date,public.report_kind,date,public.payable_status,uuid,uuid,public.payment_method,uuid,integer,integer,uuid) to authenticated,service_role;
grant execute on function public.enqueue_report_export(uuid,public.report_kind,public.report_export_format,jsonb) to authenticated;
grant execute on function public.record_immediate_report_export(uuid,public.report_kind,public.report_export_format,jsonb,integer) to authenticated;
grant execute on function public.claim_report_exports(integer) to service_role;
grant execute on function public.finish_report_export(uuid,boolean,text,bigint,integer,text) to service_role;
grant execute on function public.expire_report_exports() to service_role;
