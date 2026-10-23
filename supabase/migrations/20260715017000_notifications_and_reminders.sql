alter type public.notification_type add value if not exists 'payable_due_7_days';
alter type public.notification_type add value if not exists 'payable_due_3_days';
alter type public.notification_type add value if not exists 'payable_due_tomorrow';
alter type public.notification_type add value if not exists 'payable_due_today';
alter type public.notification_type add value if not exists 'payable_overdue';
alter type public.notification_type add value if not exists 'document_extraction_failed';

alter table public.notifications rename column message to body;

create type public.reminder_event_type as enum (
  'payable_due_7_days',
  'payable_due_3_days',
  'payable_due_tomorrow',
  'payable_due_today',
  'payable_overdue',
  'approval_requested',
  'approval_due_soon',
  'approval_completed',
  'approval_rejected',
  'document_extraction_failed'
);

create type public.notification_channel as enum ('internal', 'email', 'whatsapp');
create type public.reminder_delivery_status as enum (
  'pending',
  'processing',
  'sent',
  'failed',
  'skipped'
);

create table public.reminder_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  event_type public.reminder_event_type not null,
  days_before integer not null default 0,
  channel public.notification_channel not null,
  target_roles public.organization_role[] not null,
  active boolean not null default true,
  critical boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminder_rules_name_length check (char_length(trim(name)) between 2 and 120),
  constraint reminder_rules_days_range check (days_before between -1 and 365),
  constraint reminder_rules_roles_present check (cardinality(target_roles) > 0),
  constraint reminder_rules_whatsapp_future check (channel <> 'whatsapp' or active = false),
  constraint reminder_rules_event_days check (
    (event_type = 'payable_due_7_days' and days_before = 7)
    or (event_type = 'payable_due_3_days' and days_before = 3)
    or (event_type = 'payable_due_tomorrow' and days_before = 1)
    or (event_type = 'payable_due_today' and days_before = 0)
    or (event_type = 'payable_overdue' and days_before = -1)
    or event_type not in (
      'payable_due_7_days', 'payable_due_3_days', 'payable_due_tomorrow',
      'payable_due_today', 'payable_overdue'
    )
  ),
  constraint reminder_rules_unique unique (organization_id, event_type, channel)
);

create table public.notification_preferences (
  organization_id uuid not null,
  user_id uuid not null,
  event_type public.reminder_event_type not null,
  internal_enabled boolean not null default true,
  email_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id, event_type),
  foreign key (organization_id, user_id)
    references public.organization_members (organization_id, user_id) on delete cascade
);

create table public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rule_id uuid not null references public.reminder_rules (id) on delete cascade,
  notification_id uuid references public.notifications (id) on delete set null,
  account_payable_id uuid references public.accounts_payable (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  channel public.notification_channel not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status public.reminder_delivery_status not null default 'pending',
  provider_message_id text,
  error_code text,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminder_deliveries_attempts check (attempts between 0 and 3),
  constraint reminder_deliveries_key_length check (char_length(idempotency_key) between 8 and 240),
  constraint reminder_deliveries_provider_length check (provider_message_id is null or char_length(provider_message_id) <= 240),
  constraint reminder_deliveries_error_length check (error_code is null or char_length(error_code) <= 120),
  constraint reminder_deliveries_channel check (channel = 'email'),
  constraint reminder_deliveries_sent_state check (
    (status = 'sent' and sent_at is not null) or (status <> 'sent' and sent_at is null)
  ),
  constraint reminder_deliveries_unique unique (organization_id, idempotency_key)
);

create index reminder_rules_active_idx
  on public.reminder_rules (organization_id, event_type, channel) where active;
create index notification_preferences_user_idx
  on public.notification_preferences (user_id, organization_id);
create index reminder_deliveries_queue_idx
  on public.reminder_deliveries (status, next_attempt_at, scheduled_for)
  where status = 'pending';
create index reminder_deliveries_user_idx
  on public.reminder_deliveries (organization_id, user_id, created_at desc);
create index notifications_organization_user_created_idx
  on public.notifications (organization_id, user_id, created_at desc);

alter table public.reminder_rules enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.reminder_deliveries enable row level security;

create policy reminder_rules_select_member
on public.reminder_rules for select to authenticated
using ((select private.is_active_member(organization_id)));

create policy reminder_rules_write_admin
on public.reminder_rules for all to authenticated
using ((select private.has_organization_role(
  organization_id, array['owner', 'admin']::public.organization_role[]
)))
with check ((select private.has_organization_role(
  organization_id, array['owner', 'admin']::public.organization_role[]
)));

create policy notification_preferences_own
on public.notification_preferences for all to authenticated
using (user_id = (select auth.uid()) and (select private.is_active_member(organization_id)))
with check (user_id = (select auth.uid()) and (select private.is_active_member(organization_id)));

create policy reminder_deliveries_select_own
on public.reminder_deliveries for select to authenticated
using (user_id = (select auth.uid()) and (select private.is_active_member(organization_id)));

grant select, insert, update, delete on public.reminder_rules to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select on public.reminder_deliveries to authenticated;

create trigger reminder_rules_set_updated_at
before update on public.reminder_rules
for each row execute function private.set_updated_at();

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function private.set_updated_at();

create trigger reminder_deliveries_set_updated_at
before update on public.reminder_deliveries
for each row execute function private.set_updated_at();

create or replace function private.protect_notification_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if to_jsonb(new) - 'read_at' <> to_jsonb(old) - 'read_at' then
    raise exception 'Somente o estado de leitura pode ser alterado.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger notifications_protect_update
before update on public.notifications
for each row execute function private.protect_notification_update();

create or replace function private.insert_default_reminder_rules(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reminder_rules (
    organization_id, name, event_type, days_before, channel, target_roles, critical
  )
  select p_organization_id, event_name, event_type, days_before, channel,
    target_roles, critical
  from (values
    ('Vence em 7 dias', 'payable_due_7_days'::public.reminder_event_type, 7, array['owner','admin','operator']::public.organization_role[], false),
    ('Vence em 3 dias', 'payable_due_3_days'::public.reminder_event_type, 3, array['owner','admin','operator']::public.organization_role[], false),
    ('Vence amanhã', 'payable_due_tomorrow'::public.reminder_event_type, 1, array['owner','admin','operator']::public.organization_role[], false),
    ('Vence hoje', 'payable_due_today'::public.reminder_event_type, 0, array['owner','admin','operator']::public.organization_role[], true),
    ('Conta vencida', 'payable_overdue'::public.reminder_event_type, -1, array['owner','admin','operator']::public.organization_role[], true),
    ('Nova aprovação', 'approval_requested'::public.reminder_event_type, 0, array['owner','admin','approver']::public.organization_role[], true),
    ('Aprovação urgente', 'approval_due_soon'::public.reminder_event_type, 2, array['owner','admin','approver']::public.organization_role[], true),
    ('Conta aprovada', 'approval_completed'::public.reminder_event_type, 0, array['owner','admin','operator']::public.organization_role[], false),
    ('Conta rejeitada', 'approval_rejected'::public.reminder_event_type, 0, array['owner','admin','operator']::public.organization_role[], true),
    ('Falha na extração', 'document_extraction_failed'::public.reminder_event_type, 0, array['owner','admin','operator']::public.organization_role[], true)
  ) as defaults(event_name, event_type, days_before, target_roles, critical)
  cross join (values ('internal'::public.notification_channel), ('email'::public.notification_channel)) as channels(channel)
  on conflict (organization_id, event_type, channel) do nothing;
end;
$$;

create or replace function private.organizations_default_reminders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.insert_default_reminder_rules(new.id);
  return new;
end;
$$;

create trigger organizations_default_reminders
after insert on public.organizations
for each row execute function private.organizations_default_reminders();

do $$
declare organization_record record;
begin
  for organization_record in select id from public.organizations loop
    perform private.insert_default_reminder_rules(organization_record.id);
  end loop;
end;
$$;

create or replace function private.notify_attachment_extraction_failure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.extraction_status = 'failed' and old.extraction_status is distinct from 'failed' then
    insert into public.notifications (
      organization_id, user_id, type, title, body, entity_type, entity_id, dedupe_key
    ) values (
      new.organization_id, new.uploaded_by, 'document_extraction_failed',
      'Falha na análise do documento',
      'Não foi possível analisar "' || left(new.original_name, 180) || '". Revise o documento manualmente.',
      'payable_attachments', new.id, 'extraction-failed:' || new.id::text
    )
    on conflict (organization_id, user_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end;
$$;

create trigger payable_attachments_notify_failure
after update of extraction_status on public.payable_attachments
for each row execute function private.notify_attachment_extraction_failure();

create or replace function public.schedule_reminders(p_now timestamptz default now())
returns table (notifications_created integer, deliveries_created integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  internal_count integer := 0;
  delivery_count integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Apenas o job de lembretes pode executar esta função.' using errcode = '42501';
  end if;

  with candidates as (
    select rule.id as rule_id, rule.organization_id, rule.event_type, rule.critical,
      account.id as account_id, account.description, account.due_date,
      account.amount_cents, member.user_id,
      coalesce(preference.internal_enabled, true) as enabled
    from public.reminder_rules rule
    join public.organizations organization on organization.id = rule.organization_id
    join public.accounts_payable account on account.organization_id = rule.organization_id
    join public.organization_members member on member.organization_id = rule.organization_id
      and member.status = 'active' and member.role = any(rule.target_roles)
    left join public.notification_preferences preference
      on preference.organization_id = rule.organization_id
      and preference.user_id = member.user_id and preference.event_type = rule.event_type
    where rule.active and rule.channel = 'internal'
      and account.status not in ('paid', 'canceled', 'rejected')
      and (
        (rule.event_type = 'payable_due_7_days' and account.due_date = (p_now at time zone organization.timezone)::date + 7)
        or (rule.event_type = 'payable_due_3_days' and account.due_date = (p_now at time zone organization.timezone)::date + 3)
        or (rule.event_type = 'payable_due_tomorrow' and account.due_date = (p_now at time zone organization.timezone)::date + 1)
        or (rule.event_type = 'payable_due_today' and account.due_date = (p_now at time zone organization.timezone)::date)
        or (rule.event_type = 'payable_overdue' and account.due_date < (p_now at time zone organization.timezone)::date)
      )
  ), inserted as (
    insert into public.notifications (
      organization_id, user_id, type, title, body, entity_type, entity_id, dedupe_key
    )
    select organization_id, user_id, event_type::text::public.notification_type,
      case event_type
        when 'payable_due_7_days' then 'Conta vence em 7 dias'
        when 'payable_due_3_days' then 'Conta vence em 3 dias'
        when 'payable_due_tomorrow' then 'Conta vence amanhã'
        when 'payable_due_today' then 'Conta vence hoje'
        else 'Conta vencida'
      end,
      'A conta "' || left(description, 180) || '" tem vencimento em ' || to_char(due_date, 'DD/MM/YYYY') || '.',
      'accounts_payable', account_id,
      'reminder:' || event_type::text || ':' || account_id::text || ':' || user_id::text
    from candidates where critical or enabled
    on conflict (organization_id, user_id, dedupe_key) where dedupe_key is not null do nothing
    returning 1
  ) select count(*) into internal_count from inserted;

  -- Garante a notificação interna de aprovações urgentes em todos os fusos.
  with due_approvals as (
    select request.organization_id, request.id as request_id, account.id as account_id,
      account.description, account.due_date, member.user_id,
      (p_now at time zone organization.timezone)::date as business_date
    from public.payable_approval_requests request
    join public.accounts_payable account on account.id = request.account_payable_id
    join public.organizations organization on organization.id = request.organization_id
    join public.organization_members member on member.organization_id = request.organization_id
      and member.status = 'active' and member.role in ('owner', 'admin', 'approver')
    where request.status = 'pending'
      and account.due_date <= (p_now at time zone organization.timezone)::date + 2
      and (member.user_id <> account.created_by or organization.allow_self_approval)
  ), inserted as (
    insert into public.notifications (
      organization_id, user_id, type, title, body, entity_type, entity_id, dedupe_key
    )
    select organization_id, user_id, 'approval_due_soon',
      case when due_date < business_date then 'Aprovação vencida' else 'Aprovação próxima do vencimento' end,
      'A conta "' || left(description, 180) || '" ainda aguarda uma decisão.',
      'payable_approval_requests', request_id,
      'approval-due:' || request_id::text || ':' || business_date::text
    from due_approvals
    on conflict (organization_id, user_id, dedupe_key) where dedupe_key is not null do nothing
    returning 1
  ) select internal_count + count(*) into internal_count from inserted;

  -- Converte notificações em entregas de e-mail sem copiar dados financeiros sensíveis.
  with email_candidates as (
    select distinct on (notification.id)
      rule.id as rule_id, notification.organization_id, notification.id as notification_id,
      case
        when notification.entity_type = 'accounts_payable' then notification.entity_id
        when notification.entity_type = 'payable_approval_requests' then request.account_payable_id
        when notification.entity_type = 'payable_attachments' then attachment.account_payable_id
        else null
      end as account_id,
      notification.user_id, notification.title, notification.body,
      rule.event_type, rule.critical, coalesce(preference.email_enabled, true) as enabled
    from public.notifications notification
    join public.organization_members member
      on member.organization_id = notification.organization_id
      and member.user_id = notification.user_id and member.status = 'active'
    join public.reminder_rules rule on rule.organization_id = notification.organization_id
      and rule.channel = 'email' and rule.active
      and rule.event_type::text = notification.type::text
      and member.role = any(rule.target_roles)
    left join public.notification_preferences preference
      on preference.organization_id = notification.organization_id
      and preference.user_id = notification.user_id and preference.event_type = rule.event_type
    left join public.payable_approval_requests request
      on notification.entity_type = 'payable_approval_requests' and request.id = notification.entity_id
    left join public.payable_attachments attachment
      on notification.entity_type = 'payable_attachments' and attachment.id = notification.entity_id
    where rule.critical or coalesce(preference.email_enabled, true)
    order by notification.id, rule.created_at
  ), inserted as (
    insert into public.reminder_deliveries (
      organization_id, rule_id, notification_id, account_payable_id, user_id,
      channel, scheduled_for, payload, idempotency_key
    )
    select organization_id, rule_id, notification_id, account_id, user_id,
      'email', p_now,
      jsonb_build_object(
        'title', title, 'body', body, 'eventType', event_type::text,
        'path', case when account_id is null then '/app/notificacoes'
          else '/app/contas-a-pagar/' || account_id::text end
      ),
      'email:' || notification_id::text
    from email_candidates where critical or enabled
    on conflict (organization_id, idempotency_key) do nothing
    returning 1
  ) select count(*) into delivery_count from inserted;

  return query select internal_count, delivery_count;
end;
$$;

create or replace function public.claim_reminder_deliveries(p_limit integer default 25)
returns table (
  delivery_id uuid,
  recipient_email text,
  idempotency_key text,
  title text,
  body text,
  path text,
  attempt integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Apenas o job de lembretes pode consumir a fila.' using errcode = '42501';
  end if;
  if p_limit not between 1 and 100 then
    raise exception 'Limite inválido.' using errcode = '22023';
  end if;

  return query
  with claimed as (
    select delivery.id
    from public.reminder_deliveries delivery
    join public.organization_members member
      on member.organization_id = delivery.organization_id
      and member.user_id = delivery.user_id and member.status = 'active'
    where delivery.status = 'pending'
      and delivery.next_attempt_at <= now() and delivery.scheduled_for <= now()
    order by delivery.scheduled_for, delivery.created_at
    for update of delivery skip locked
    limit p_limit
  ), updated as (
    update public.reminder_deliveries delivery
    set status = 'processing', attempts = attempts + 1
    from claimed where delivery.id = claimed.id
    returning delivery.*
  )
  select updated.id, user_record.email::text, updated.idempotency_key,
    coalesce(updated.payload ->> 'title', 'Lembrete da Vencii'),
    coalesce(updated.payload ->> 'body', 'Você tem uma atualização na Vencii.'),
    coalesce(updated.payload ->> 'path', '/app/notificacoes'), updated.attempts
  from updated
  join auth.users user_record on user_record.id = updated.user_id
  where user_record.email is not null;
end;
$$;

create or replace function public.finish_reminder_delivery(
  p_delivery_id uuid,
  p_success boolean,
  p_provider_message_id text default null,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Apenas o job de lembretes pode concluir a fila.' using errcode = '42501';
  end if;

  update public.reminder_deliveries
  set status = case
        when p_success then 'sent'::public.reminder_delivery_status
        when attempts >= 3 then 'failed'::public.reminder_delivery_status
        else 'pending'::public.reminder_delivery_status
      end,
      sent_at = case when p_success then now() else null end,
      provider_message_id = case when p_success then left(p_provider_message_id, 240) else null end,
      error_code = case when p_success then null else left(coalesce(p_error_code, 'temporary_failure'), 120) end,
      next_attempt_at = case when p_success or attempts >= 3 then next_attempt_at
        else now() + make_interval(mins => power(5, attempts)::integer) end
  where id = p_delivery_id and status = 'processing';

  if not found then
    raise exception 'Entrega não está em processamento.' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.schedule_reminders(timestamptz) from public, anon, authenticated;
revoke all on function public.claim_reminder_deliveries(integer) from public, anon, authenticated;
revoke all on function public.finish_reminder_delivery(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.schedule_reminders(timestamptz) to service_role;
grant execute on function public.claim_reminder_deliveries(integer) to service_role;
grant execute on function public.finish_reminder_delivery(uuid, boolean, text, text) to service_role;
