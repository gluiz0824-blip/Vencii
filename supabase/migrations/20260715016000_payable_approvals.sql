alter table public.organizations
  add column allow_self_approval boolean not null default false;

create type public.approval_request_status as enum (
  'pending',
  'approved',
  'rejected',
  'invalidated'
);

create type public.approval_decision as enum ('approved', 'rejected');

create type public.notification_type as enum (
  'approval_requested',
  'approval_completed',
  'approval_rejected',
  'approval_due_soon'
);

create table public.approval_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  min_amount_cents bigint,
  max_amount_cents bigint,
  category_id uuid references public.expense_categories (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete cascade,
  required_approvals integer not null default 1,
  active boolean not null default true,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approval_rules_name_length check (char_length(trim(name)) between 2 and 120),
  constraint approval_rules_amounts_positive check (
    (min_amount_cents is null or min_amount_cents >= 0)
    and (max_amount_cents is null or max_amount_cents > 0)
  ),
  constraint approval_rules_amount_range check (
    min_amount_cents is null or max_amount_cents is null or min_amount_cents <= max_amount_cents
  ),
  constraint approval_rules_required_count check (required_approvals between 1 and 10),
  constraint approval_rules_priority_range check (priority between 0 and 1000)
);

create index approval_rules_match_idx
  on public.approval_rules (organization_id, active, priority desc);
create index approval_rules_category_idx
  on public.approval_rules (organization_id, category_id) where category_id is not null;
create index approval_rules_supplier_idx
  on public.approval_rules (organization_id, supplier_id) where supplier_id is not null;

create table public.payable_approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_payable_id uuid not null references public.accounts_payable (id) on delete cascade,
  rule_id uuid references public.approval_rules (id) on delete set null,
  required_approvals integer not null,
  status public.approval_request_status not null default 'pending',
  requested_by uuid not null references auth.users (id) on delete restrict,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint payable_approval_requests_required_count check (required_approvals between 1 and 10),
  constraint payable_approval_requests_completion check (
    (status = 'pending' and completed_at is null)
    or (status <> 'pending' and completed_at is not null)
  )
);

create unique index payable_approval_requests_one_pending
  on public.payable_approval_requests (account_payable_id)
  where status = 'pending';
create index payable_approval_requests_inbox_idx
  on public.payable_approval_requests (organization_id, status, requested_at desc);
create index payable_approval_requests_account_idx
  on public.payable_approval_requests (organization_id, account_payable_id, requested_at desc);

create table public.payable_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  request_id uuid not null references public.payable_approval_requests (id) on delete cascade,
  approver_id uuid not null references auth.users (id) on delete restrict,
  decision public.approval_decision not null,
  comment text,
  decided_at timestamptz not null default now(),
  constraint payable_approvals_comment_length check (comment is null or char_length(comment) <= 1000),
  constraint payable_approvals_rejection_comment check (
    decision <> 'rejected' or char_length(trim(coalesce(comment, ''))) between 3 and 1000
  ),
  constraint payable_approvals_unique_approver unique (request_id, approver_id)
);

create index payable_approvals_request_idx
  on public.payable_approvals (organization_id, request_id, decided_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  message text not null,
  entity_type text not null,
  entity_id uuid,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_title_length check (char_length(title) between 2 and 160),
  constraint notifications_message_length check (char_length(message) between 2 and 500),
  constraint notifications_entity_type_length check (char_length(entity_type) between 1 and 80),
  constraint notifications_dedupe_key_length check (dedupe_key is null or char_length(dedupe_key) between 8 and 240)
);

create unique index notifications_dedupe_unique
  on public.notifications (organization_id, user_id, dedupe_key)
  where dedupe_key is not null;
create index notifications_user_unread_idx
  on public.notifications (user_id, read_at, created_at desc);

alter table public.approval_rules enable row level security;
alter table public.payable_approval_requests enable row level security;
alter table public.payable_approvals enable row level security;
alter table public.notifications enable row level security;

create policy approval_rules_select_active_member
on public.approval_rules for select to authenticated
using ((select private.is_active_member(organization_id)));

create policy approval_rules_write_admin
on public.approval_rules for all to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['owner', 'admin']::public.organization_role[]
)))
with check ((select private.has_organization_role(
  organization_id,
  array['owner', 'admin']::public.organization_role[]
)));

create policy payable_approval_requests_select_active_member
on public.payable_approval_requests for select to authenticated
using ((select private.is_active_member(organization_id)));

create policy payable_approvals_select_active_member
on public.payable_approvals for select to authenticated
using ((select private.is_active_member(organization_id)));

create policy notifications_select_own
on public.notifications for select to authenticated
using (user_id = (select auth.uid()) and (select private.is_active_member(organization_id)));

create policy notifications_update_own
on public.notifications for update to authenticated
using (user_id = (select auth.uid()) and (select private.is_active_member(organization_id)))
with check (user_id = (select auth.uid()) and (select private.is_active_member(organization_id)));

grant select, insert, update, delete on public.approval_rules to authenticated;
grant select on public.payable_approval_requests, public.payable_approvals to authenticated;
grant select, update on public.notifications to authenticated;

create trigger approval_rules_set_updated_at
before update on public.approval_rules
for each row execute function private.set_updated_at();

create or replace function private.protect_approval_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
    raise exception 'A organização da regra é imutável.' using errcode = '42501';
  end if;
  if new.category_id is not null and not exists (
    select 1 from public.expense_categories category
    where category.id = new.category_id and category.organization_id = new.organization_id
  ) then
    raise exception 'Categoria não pertence à organização.' using errcode = '23503';
  end if;
  if new.supplier_id is not null and not exists (
    select 1 from public.suppliers supplier
    where supplier.id = new.supplier_id and supplier.organization_id = new.organization_id
  ) then
    raise exception 'Fornecedor não pertence à organização.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger approval_rules_protect
before insert or update on public.approval_rules
for each row execute function private.protect_approval_rule();

create trigger approval_rules_audit
after insert or update or delete on public.approval_rules
for each row execute function private.write_audit_log();

create trigger payable_approval_requests_audit
after insert or update on public.payable_approval_requests
for each row execute function private.write_audit_log();

create trigger payable_approvals_audit
after insert on public.payable_approvals
for each row execute function private.write_audit_log();

create or replace function private.match_approval_rule(
  p_organization_id uuid,
  p_amount_cents bigint,
  p_category_id uuid,
  p_supplier_id uuid
)
returns table (rule_id uuid, required_approvals integer)
language sql
stable
security definer
set search_path = ''
as $$
  select rule.id, rule.required_approvals
  from public.approval_rules rule
  where rule.organization_id = p_organization_id
    and rule.active
    and (rule.min_amount_cents is null or p_amount_cents >= rule.min_amount_cents)
    and (rule.max_amount_cents is null or p_amount_cents <= rule.max_amount_cents)
    and (rule.category_id is null or rule.category_id = p_category_id)
    and (rule.supplier_id is null or rule.supplier_id = p_supplier_id)
  order by (
    (rule.category_id is not null)::integer
    + (rule.supplier_id is not null)::integer
    + (rule.min_amount_cents is not null)::integer
    + (rule.max_amount_cents is not null)::integer
  ) desc,
  rule.priority desc,
  rule.created_at,
  rule.id
  limit 1;
$$;

create or replace function private.notify_approval_requested(
  p_organization_id uuid,
  p_request_id uuid,
  p_account_description text,
  p_requested_by uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (
    organization_id, user_id, type, title, message, entity_type, entity_id, dedupe_key
  )
  select
    p_organization_id,
    member.user_id,
    'approval_requested',
    'Nova conta para aprovação',
    'A conta "' || left(p_account_description, 180) || '" aguarda uma decisão.',
    'payable_approval_requests',
    p_request_id,
    'approval-requested:' || p_request_id::text
  from public.organization_members member
  where member.organization_id = p_organization_id
    and member.status = 'active'
    and member.role in ('owner', 'admin', 'approver')
    and member.user_id <> p_requested_by
  on conflict (organization_id, user_id, dedupe_key) where dedupe_key is not null do nothing;
$$;

create or replace function private.create_payable_approval_request(
  p_organization_id uuid,
  p_account_id uuid,
  p_requested_by uuid,
  p_only_if_rule_matches boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_record public.accounts_payable%rowtype;
  matched_rule_id uuid;
  approvals_required integer;
  request_id uuid;
begin
  select * into account_record
  from public.accounts_payable account
  where account.id = p_account_id and account.organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Conta não encontrada.' using errcode = 'P0002';
  end if;
  if account_record.status in ('paid', 'canceled', 'rejected') then
    raise exception 'Esta conta não pode ser enviada para aprovação.' using errcode = 'P0001';
  end if;

  select matched.rule_id, matched.required_approvals
  into matched_rule_id, approvals_required
  from private.match_approval_rule(
    p_organization_id,
    account_record.amount_cents,
    account_record.expense_category_id,
    account_record.supplier_id
  ) matched;

  if matched_rule_id is null and p_only_if_rule_matches then
    return null;
  end if;
  approvals_required := coalesce(approvals_required, 1);

  select request.id into request_id
  from public.payable_approval_requests request
  where request.account_payable_id = p_account_id and request.status = 'pending';
  if request_id is not null then
    return request_id;
  end if;

  insert into public.payable_approval_requests (
    organization_id, account_payable_id, rule_id, required_approvals, requested_by
  ) values (
    p_organization_id, p_account_id, matched_rule_id, approvals_required, p_requested_by
  ) returning id into request_id;

  update public.accounts_payable
  set status = 'awaiting_approval', updated_by = p_requested_by
  where id = p_account_id;

  perform private.notify_approval_requested(
    p_organization_id, request_id, account_record.description, p_requested_by
  );
  return request_id;
end;
$$;

create or replace function public.request_payable_approval(
  p_organization_id uuid,
  p_account_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not private.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'operator']::public.organization_role[],
    current_user_id
  ) then
    raise exception 'Sem permissão para enviar esta conta para aprovação.' using errcode = '42501';
  end if;
  return private.create_payable_approval_request(
    p_organization_id, p_account_id, current_user_id, false
  );
end;
$$;

create or replace function private.auto_request_payable_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('draft', 'pending') then
    perform private.create_payable_approval_request(
      new.organization_id, new.id, new.created_by, true
    );
  end if;
  return new;
end;
$$;

create trigger accounts_payable_auto_approval
after insert on public.accounts_payable
for each row execute function private.auto_request_payable_approval();

create or replace function public.decide_payable_approval(
  p_organization_id uuid,
  p_request_id uuid,
  p_decision public.approval_decision,
  p_comment text default null
)
returns public.approval_request_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request_record public.payable_approval_requests%rowtype;
  account_record public.accounts_payable%rowtype;
  self_approval_allowed boolean;
  approval_count integer;
  final_status public.approval_request_status;
begin
  if current_user_id is null or not private.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'approver']::public.organization_role[],
    current_user_id
  ) then
    raise exception 'Sem permissão para decidir esta aprovação.' using errcode = '42501';
  end if;
  if p_decision = 'rejected' and char_length(trim(coalesce(p_comment, ''))) < 3 then
    raise exception 'A rejeição exige uma justificativa.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_comment, '')) > 1000 then
    raise exception 'O comentário deve ter até 1000 caracteres.' using errcode = '22023';
  end if;

  select * into request_record
  from public.payable_approval_requests request
  where request.id = p_request_id and request.organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'Solicitação não encontrada.' using errcode = 'P0002';
  end if;
  if request_record.status <> 'pending' then
    raise exception 'Esta solicitação já foi concluída.' using errcode = 'P0001';
  end if;

  select * into account_record
  from public.accounts_payable account
  where account.id = request_record.account_payable_id
  for update;
  select organization.allow_self_approval into self_approval_allowed
  from public.organizations organization where organization.id = p_organization_id;
  if account_record.created_by = current_user_id and not self_approval_allowed then
    raise exception 'Quem criou a conta não pode aprová-la.' using errcode = '42501';
  end if;

  insert into public.payable_approvals (
    organization_id, request_id, approver_id, decision, comment
  ) values (
    p_organization_id, p_request_id, current_user_id, p_decision,
    nullif(trim(coalesce(p_comment, '')), '')
  );

  perform set_config('vencii.allow_approval_decision', 'on', true);
  if p_decision = 'rejected' then
    update public.payable_approval_requests
    set status = 'rejected', completed_at = now()
    where id = p_request_id;
    update public.accounts_payable
    set status = 'rejected', updated_by = current_user_id
    where id = request_record.account_payable_id;
    final_status := 'rejected';
  else
    select count(*) into approval_count
    from public.payable_approvals approval
    where approval.request_id = p_request_id and approval.decision = 'approved';
    if approval_count >= request_record.required_approvals then
      update public.payable_approval_requests
      set status = 'approved', completed_at = now()
      where id = p_request_id;
      update public.accounts_payable
      set status = 'approved', updated_by = current_user_id
      where id = request_record.account_payable_id;
      final_status := 'approved';
    else
      final_status := 'pending';
    end if;
  end if;

  insert into public.notifications (
    organization_id, user_id, type, title, message, entity_type, entity_id, dedupe_key
  )
  select distinct
    p_organization_id,
    recipient.user_id,
    case when final_status = 'rejected'
      then 'approval_rejected'::public.notification_type
      else 'approval_completed'::public.notification_type end,
    case when final_status = 'rejected' then 'Conta rejeitada' else 'Aprovação atualizada' end,
    case
      when final_status = 'rejected' then 'A conta "' || left(account_record.description, 180) || '" foi rejeitada.'
      when final_status = 'approved' then 'A conta "' || left(account_record.description, 180) || '" foi aprovada.'
      else 'A conta "' || left(account_record.description, 180) || '" recebeu uma aprovação.'
    end,
    'payable_approval_requests',
    p_request_id,
    'approval-decision:' || p_request_id::text || ':' || current_user_id::text
  from (
    values (request_record.requested_by), (account_record.created_by)
  ) recipient(user_id)
  where recipient.user_id <> current_user_id
  on conflict (organization_id, user_id, dedupe_key) where dedupe_key is not null do nothing;

  return final_status;
exception
  when unique_violation then
    raise exception 'Você já decidiu esta solicitação.' using errcode = '23505';
end;
$$;

create or replace function public.approve_payable_requests_batch(
  p_organization_id uuid,
  p_request_ids uuid[],
  p_comment text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_id uuid;
  processed integer := 0;
begin
  if coalesce(array_length(p_request_ids, 1), 0) < 1
    or array_length(p_request_ids, 1) > 100 then
    raise exception 'Selecione entre 1 e 100 solicitações.' using errcode = '22023';
  end if;
  for request_id in select distinct unnest(p_request_ids) order by 1 loop
    perform public.decide_payable_approval(
      p_organization_id, request_id, 'approved', p_comment
    );
    processed := processed + 1;
  end loop;
  return processed;
end;
$$;

create or replace function private.invalidate_payable_approval_after_financial_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_request public.payable_approval_requests%rowtype;
begin
  if new.amount_cents is not distinct from old.amount_cents
    and new.supplier_id is not distinct from old.supplier_id
    and new.due_date is not distinct from old.due_date then
    return new;
  end if;

  select * into previous_request
  from public.payable_approval_requests request
  where request.account_payable_id = new.id and request.status = 'approved'
  order by request.completed_at desc
  limit 1
  for update;
  if not found then
    return new;
  end if;

  update public.payable_approval_requests
  set status = 'invalidated', completed_at = now()
  where id = previous_request.id;

  perform private.create_payable_approval_request(
    new.organization_id, new.id, new.updated_by, false
  );
  return new;
end;
$$;

create trigger accounts_payable_invalidate_approval
after update of amount_cents, supplier_id, due_date on public.accounts_payable
for each row execute function private.invalidate_payable_approval_after_financial_change();

create or replace function public.get_approval_inbox(
  p_organization_id uuid,
  p_business_date date,
  p_urgency text default null,
  p_due_from date default null,
  p_due_to date default null,
  p_min_amount_cents bigint default null,
  p_max_amount_cents bigint default null,
  p_supplier_id uuid default null
)
returns table (
  request_id uuid,
  account_id uuid,
  description text,
  supplier_name text,
  amount_cents bigint,
  due_date date,
  document_type public.payable_document_type,
  document_number text,
  barcode text,
  required_approvals integer,
  approval_count bigint,
  requested_at timestamptz,
  created_by uuid,
  can_decide boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'approver']::public.organization_role[],
    auth.uid()
  ) then
    raise exception 'Sem permissão para consultar aprovações.' using errcode = '42501';
  end if;
  if p_urgency is not null and p_urgency not in ('overdue', 'today', 'next_7_days') then
    raise exception 'Filtro de urgência inválido.' using errcode = '22023';
  end if;

  return query
  select
    request.id,
    account.id,
    account.description,
    supplier.name,
    account.amount_cents,
    account.due_date,
    account.document_type,
    account.document_number,
    account.barcode,
    request.required_approvals,
    count(approval.id) filter (where approval.decision = 'approved'),
    request.requested_at,
    account.created_by,
    (organization.allow_self_approval or account.created_by <> auth.uid())
  from public.payable_approval_requests request
  join public.accounts_payable account on account.id = request.account_payable_id
  join public.organizations organization on organization.id = request.organization_id
  left join public.suppliers supplier on supplier.id = account.supplier_id
  left join public.payable_approvals approval on approval.request_id = request.id
  where request.organization_id = p_organization_id
    and request.status = 'pending'
    and (p_due_from is null or account.due_date >= p_due_from)
    and (p_due_to is null or account.due_date <= p_due_to)
    and (p_min_amount_cents is null or account.amount_cents >= p_min_amount_cents)
    and (p_max_amount_cents is null or account.amount_cents <= p_max_amount_cents)
    and (p_supplier_id is null or account.supplier_id = p_supplier_id)
    and (
      p_urgency is null
      or (p_urgency = 'overdue' and account.due_date < p_business_date)
      or (p_urgency = 'today' and account.due_date = p_business_date)
      or (p_urgency = 'next_7_days' and account.due_date between p_business_date and p_business_date + 7)
    )
  group by request.id, account.id, supplier.name, organization.allow_self_approval
  order by account.due_date, account.amount_cents desc, request.requested_at;
end;
$$;

create or replace function public.create_due_approval_notifications(
  p_organization_id uuid,
  p_business_date date,
  p_days_ahead integer default 2
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if auth.uid() is null or not private.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'approver']::public.organization_role[],
    auth.uid()
  ) then
    raise exception 'Sem permissão para gerar notificações.' using errcode = '42501';
  end if;
  if p_days_ahead not between 0 and 30 then
    raise exception 'Janela de notificação inválida.' using errcode = '22023';
  end if;

  insert into public.notifications (
    organization_id, user_id, type, title, message, entity_type, entity_id, dedupe_key
  )
  select
    p_organization_id,
    member.user_id,
    'approval_due_soon',
    case when account.due_date < p_business_date then 'Aprovação vencida' else 'Aprovação próxima do vencimento' end,
    'A conta "' || left(account.description, 180) || '" ainda aguarda uma decisão.',
    'payable_approval_requests',
    request.id,
    'approval-due:' || request.id::text || ':' || p_business_date::text
  from public.payable_approval_requests request
  join public.accounts_payable account on account.id = request.account_payable_id
  join public.organization_members member on member.organization_id = request.organization_id
  where request.organization_id = p_organization_id
    and request.status = 'pending'
    and account.due_date <= p_business_date + p_days_ahead
    and member.status = 'active'
    and member.role in ('owner', 'admin', 'approver')
    and (member.user_id <> account.created_by or (
      select organization.allow_self_approval
      from public.organizations organization where organization.id = p_organization_id
    ))
  on conflict (organization_id, user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

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
    if new.status in ('approved', 'scheduled', 'paid', 'rejected')
      and coalesce(current_setting('vencii.allow_approval_decision', true), '') <> 'on'
      and not private.has_organization_role(new.organization_id, array['owner', 'admin']::public.organization_role[], auth.uid()) then
      raise exception 'O papel operator não pode definir estados de decisão ou pagamento.' using errcode = '42501';
    end if;
  else
    if new.organization_id <> old.organization_id or new.created_by <> old.created_by
      or new.idempotency_key <> old.idempotency_key or new.occurrence_index <> old.occurrence_index then
      raise exception 'Organização, autoria e chave idempotente são imutáveis.' using errcode = '42501';
    end if;
    if old.status in ('paid', 'canceled', 'rejected') and (
      to_jsonb(new) - array['notes', 'updated_by', 'updated_at']
      <> to_jsonb(old) - array['notes', 'updated_by', 'updated_at']
    ) then
      raise exception 'Conta finalizada permite alterar somente observações.' using errcode = '42501';
    end if;
    if new.status = 'canceled' and old.status <> 'canceled'
      and coalesce(current_setting('vencii.allow_payable_cancellation', true), '') <> 'on' then
      raise exception 'Use o fluxo de cancelamento com motivo.' using errcode = '42501';
    end if;
    if new.status is distinct from old.status
      and new.status in ('approved', 'scheduled', 'paid', 'rejected')
      and coalesce(current_setting('vencii.allow_approval_decision', true), '') <> 'on'
      and not private.has_organization_role(new.organization_id, array['owner', 'admin']::public.organization_role[], auth.uid()) then
      raise exception 'O papel operator não pode definir estados de decisão ou pagamento.' using errcode = '42501';
    end if;
    if new.updated_by <> auth.uid() then
      raise exception 'O editor deve ser o usuário autenticado.' using errcode = '42501';
    end if;
  end if;
  if new.supplier_id is not null and not exists (
    select 1 from public.suppliers supplier where supplier.id = new.supplier_id and supplier.organization_id = new.organization_id
  ) then
    raise exception 'Fornecedor não pertence à organização.' using errcode = '23503';
  end if;
  if new.expense_category_id is not null and not exists (
    select 1 from public.expense_categories category where category.id = new.expense_category_id and category.organization_id = new.organization_id
  ) then
    raise exception 'Categoria não pertence à organização.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create or replace function public.mark_account_payable_paid(
  p_organization_id uuid,
  p_account_id uuid,
  p_paid_date date,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_status public.payable_status;
  business_today date;
begin
  if current_user_id is null or not private.has_organization_role(
    p_organization_id, array['owner', 'admin']::public.organization_role[], current_user_id
  ) then
    raise exception 'Somente owner ou admin pode registrar um pagamento.' using errcode = '42501';
  end if;
  if p_paid_date is null then raise exception 'Informe a data do pagamento.' using errcode = '22023'; end if;
  select (now() at time zone organization.timezone)::date into business_today
  from public.organizations organization where organization.id = p_organization_id;
  if p_paid_date > business_today then
    raise exception 'A data do pagamento não pode estar no futuro.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_notes, '')) > 1000 then
    raise exception 'A observação do pagamento deve ter até 1000 caracteres.' using errcode = '22023';
  end if;
  select status into current_status from public.accounts_payable
  where id = p_account_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Conta não encontrada.' using errcode = 'P0002'; end if;
  if current_status = 'paid' then return; end if;
  if current_status not in ('pending', 'awaiting_approval', 'approved', 'scheduled', 'overdue') then
    raise exception 'Esta conta não pode ser marcada como paga no estado atual.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.payable_approval_requests request
    where request.account_payable_id = p_account_id
  ) and not exists (
    select 1 from public.payable_approval_requests request
    where request.account_payable_id = p_account_id and request.status = 'approved'
  ) then
    raise exception 'A conta precisa ser aprovada antes do registro de pagamento.' using errcode = 'P0001';
  end if;
  perform set_config('vencii.allow_payable_payment', 'on', true);
  update public.accounts_payable
  set status = 'paid', paid_date = p_paid_date,
      payment_notes = nullif(trim(coalesce(p_notes, '')), ''), updated_by = current_user_id
  where id = p_account_id and organization_id = p_organization_id;
end;
$$;

revoke all on function public.request_payable_approval(uuid, uuid) from public, anon;
revoke all on function public.decide_payable_approval(uuid, uuid, public.approval_decision, text) from public, anon;
revoke all on function public.approve_payable_requests_batch(uuid, uuid[], text) from public, anon;
revoke all on function public.get_approval_inbox(uuid, date, text, date, date, bigint, bigint, uuid) from public, anon;
revoke all on function public.create_due_approval_notifications(uuid, date, integer) from public, anon;
grant execute on function public.request_payable_approval(uuid, uuid) to authenticated;
grant execute on function public.decide_payable_approval(uuid, uuid, public.approval_decision, text) to authenticated;
grant execute on function public.approve_payable_requests_batch(uuid, uuid[], text) to authenticated;
grant execute on function public.get_approval_inbox(uuid, date, text, date, date, bigint, bigint, uuid) to authenticated;
grant execute on function public.create_due_approval_notifications(uuid, date, integer) to authenticated;
