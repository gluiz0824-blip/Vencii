begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

insert into auth.users (id, email)
values
  ('81000000-0000-0000-0000-000000000001', 'owner-reminders@vencii.test'),
  ('81000000-0000-0000-0000-000000000002', 'operator-removed@vencii.test'),
  ('82000000-0000-0000-0000-000000000001', 'owner-reminders-b@vencii.test');

insert into public.organizations (id, legal_name, trade_name, timezone, owner_id)
values
  ('8a000000-0000-0000-0000-000000000001', 'Lembretes A Ltda', 'Lembretes A', 'America/Sao_Paulo', '81000000-0000-0000-0000-000000000001'),
  ('8b000000-0000-0000-0000-000000000001', 'Lembretes B Ltda', 'Lembretes B', 'Pacific/Kiritimati', '82000000-0000-0000-0000-000000000001');

insert into public.organization_members (organization_id, user_id, role, status, joined_at)
values
  ('8a000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('8a000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', 'operator', 'suspended', null),
  ('8b000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 'owner', 'active', now());

select is(
  (select count(*) from public.reminder_rules where organization_id = '8a000000-0000-0000-0000-000000000001'),
  20::bigint,
  'nova organização recebe regras internas e de e-mail'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into public.accounts_payable (
  id, organization_id, description, document_type, amount_cents, due_date,
  status, idempotency_key, created_by, updated_by
) values
  ('8c000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000001', 'Vence amanhã no fuso local', 'boleto', 10000, '2026-07-15', 'pending', 'reminder-account-0001', '81000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001'),
  ('8c000000-0000-0000-0000-000000000002', '8a000000-0000-0000-0000-000000000001', 'Lembrete desativado', 'pix', 20000, '2026-07-21', 'pending', 'reminder-account-0002', '81000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001'),
  ('8c000000-0000-0000-0000-000000000003', '8a000000-0000-0000-0000-000000000001', 'Alerta crítico de hoje', 'outro', 30000, '2026-07-14', 'pending', 'reminder-account-0003', '81000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001');

insert into public.notification_preferences (
  organization_id, user_id, event_type, internal_enabled, email_enabled
) values
  ('8a000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'payable_due_7_days', false, false),
  ('8a000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'payable_due_today', false, false);

reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select results_eq(
  $$ select * from public.schedule_reminders('2026-07-15 02:30:00+00'::timestamptz) $$,
  $$ values (2, 2) $$,
  'job cria alertas habilitados e mantém o alerta crítico'
);

select is(
  (select count(*) from public.notifications where type = 'payable_due_7_days' and organization_id = '8a000000-0000-0000-0000-000000000001'),
  0::bigint,
  'preferência desativa evento não crítico'
);

select is(
  (select type from public.notifications where entity_id = '8c000000-0000-0000-0000-000000000001'),
  'payable_due_tomorrow'::public.notification_type,
  'data próxima da meia-noite respeita o fuso da organização'
);

select is(
  (select count(*) from public.notifications where entity_id = '8c000000-0000-0000-0000-000000000003'),
  1::bigint,
  'preferência não desativa alerta crítico definido pela empresa'
);

select results_eq(
  $$ select * from public.schedule_reminders('2026-07-15 02:30:00+00'::timestamptz) $$,
  $$ values (0, 0) $$,
  'segunda execução não duplica notificações nem entregas'
);

create temporary table claimed_reminders as
select * from public.claim_reminder_deliveries(25);

select is(
  (select count(*) from claimed_reminders),
  2::bigint,
  'fila reivindica uma entrega por notificação habilitada'
);

select lives_ok(
  $$ select public.finish_reminder_delivery(
    (select delivery_id from claimed_reminders limit 1), false, null, 'provider_timeout'
  ) $$,
  'falha temporária devolve a entrega à fila'
);

select ok(
  (select status = 'pending' and attempts = 1 and error_code = 'provider_timeout'
   from public.reminder_deliveries where id = (select delivery_id from claimed_reminders limit 1)),
  'falha registra tentativa e agenda retentativa'
);

update public.reminder_deliveries
set status = 'processing', attempts = 3
where id = (select delivery_id from claimed_reminders limit 1);
select public.finish_reminder_delivery(
  (select delivery_id from claimed_reminders limit 1), false, null, 'provider_timeout'
);

select is(
  (select status from public.reminder_deliveries where id = (select delivery_id from claimed_reminders limit 1)),
  'failed'::public.reminder_delivery_status,
  'terceira falha encerra as retentativas'
);

reset role;
update public.reminder_deliveries
set user_id = '81000000-0000-0000-0000-000000000002',
    status = 'pending', next_attempt_at = now() - interval '1 minute'
where id = (select delivery_id from claimed_reminders offset 1 limit 1);

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select is(
  (select count(*) from public.claim_reminder_deliveries(25)),
  0::bigint,
  'usuário removido ou suspenso não recebe entregas'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"82000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (select count(*) from public.notifications where organization_id = '8a000000-0000-0000-0000-000000000001'),
  0::bigint,
  'RLS bloqueia notificações de outra organização'
);

select * from finish();
rollback;
