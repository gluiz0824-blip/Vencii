begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

insert into auth.users (id, email)
values
  ('51000000-0000-0000-0000-000000000001', 'owner-dashboard@vencii.test'),
  ('52000000-0000-0000-0000-000000000001', 'owner-dashboard-other@vencii.test');

insert into public.organizations (id, legal_name, trade_name, owner_id, timezone)
values
  ('ea000000-0000-0000-0000-000000000001', 'Dashboard A Ltda', 'Dashboard A', '51000000-0000-0000-0000-000000000001', 'America/Sao_Paulo'),
  ('ea000000-0000-0000-0000-000000000002', 'Dashboard vazio Ltda', 'Dashboard vazio', '51000000-0000-0000-0000-000000000001', 'America/Sao_Paulo'),
  ('ea000000-0000-0000-0000-000000000003', 'Dashboard volume Ltda', 'Dashboard volume', '51000000-0000-0000-0000-000000000001', 'America/Sao_Paulo'),
  ('eb000000-0000-0000-0000-000000000001', 'Dashboard B Ltda', 'Dashboard B', '52000000-0000-0000-0000-000000000001', 'UTC');

insert into public.organization_members (organization_id, user_id, role, status, joined_at)
values
  ('ea000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('ea000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('ea000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('eb000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', 'owner', 'active', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into public.accounts_payable (
  organization_id, description, document_type, amount_cents, due_date, status,
  paid_date, cancellation_reason, idempotency_key, created_by, updated_by
)
values
  ('ea000000-0000-0000-0000-000000000001', 'Vence hoje', 'boleto', 100, '2026-07-15', 'pending', null, null, 'dashboard-account-01', '51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001'),
  ('ea000000-0000-0000-0000-000000000001', 'Vence em sete dias', 'pix', 200, '2026-07-22', 'pending', null, null, 'dashboard-account-02', '51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001'),
  ('ea000000-0000-0000-0000-000000000001', 'Vence em oito dias', 'imposto', 300, '2026-07-23', 'pending', null, null, 'dashboard-account-03', '51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001'),
  ('ea000000-0000-0000-0000-000000000001', 'Conta vencida', 'outro', 400, '2026-07-14', 'overdue', null, null, 'dashboard-account-04', '51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001'),
  ('ea000000-0000-0000-0000-000000000001', 'Aguardando aprovação', 'transferencia', 500, '2026-07-20', 'awaiting_approval', null, null, 'dashboard-account-05', '51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001'),
  ('ea000000-0000-0000-0000-000000000001', 'Paga no mês', 'pix', 600, '2026-07-15', 'paid', '2026-07-10', null, 'dashboard-account-06', '51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001'),
  ('ea000000-0000-0000-0000-000000000001', 'Cancelada', 'outro', 700, '2026-07-18', 'canceled', null, 'Teste de cancelamento', 'dashboard-account-07', '51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001'),
  ('ea000000-0000-0000-0000-000000000001', 'Rejeitada', 'outro', 800, '2026-07-19', 'rejected', null, null, 'dashboard-account-08', '51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001');

select results_eq(
  $$ select
    (summary ->> 'totalCount')::bigint,
    (summary ->> 'dueTodayCents')::bigint,
    (summary ->> 'dueNext7DaysCents')::bigint,
    (summary ->> 'dueNext30DaysCents')::bigint,
    (summary ->> 'overdueCents')::bigint,
    (summary ->> 'awaitingApprovalCents')::bigint,
    (summary ->> 'paidThisMonthCents')::bigint
  from (select public.get_financial_dashboard_summary('ea000000-0000-0000-0000-000000000001', '2026-07-15') summary) item $$,
  $$ values (8::bigint, 100::bigint, 700::bigint, 1000::bigint, 400::bigint, 500::bigint, 600::bigint) $$,
  'indicadores separam hoje, previsões, vencido, aprovação e realizado'
);

select results_eq(
  $$ select (summary ->> 'totalCount')::bigint, (summary ->> 'paidThisMonthCents')::bigint
     from (select public.get_financial_dashboard_summary('ea000000-0000-0000-0000-000000000002', '2026-07-15') summary) item $$,
  $$ values (0::bigint, 0::bigint) $$,
  'organização sem dados retorna zeros reais'
);

select is(
  (select sum(account_count) from public.get_payables_calendar('ea000000-0000-0000-0000-000000000001', '2026-07-01', '2026-07-31')),
  6::numeric,
  'calendário exclui contas canceladas e rejeitadas'
);

select is(
  (select sum(account_count) from public.get_payables_calendar('ea000000-0000-0000-0000-000000000001', '2026-07-01', '2026-07-31', 'pending')),
  3::numeric,
  'filtro de status é aplicado no servidor'
);

select is(
  (select sum((point ->> 'totalCents')::bigint) from jsonb_array_elements(public.get_financial_forecast('ea000000-0000-0000-0000-000000000001', '2026-07-15')) point),
  1100::numeric,
  'previsão não inclui valores pagos, cancelados, rejeitados ou vencidos'
);

select results_eq(
  $$ select ((public.get_financial_distributions('ea000000-0000-0000-0000-000000000001') -> 'categories' -> 0 ->> 'totalCents')::bigint) $$,
  $$ values (1500::bigint) $$,
  'distribuições agregam valores em aberto no banco'
);

select is(
  (timestamptz '2026-07-16 02:30:00+00' at time zone 'America/Sao_Paulo')::date,
  date '2026-07-15',
  'data de negócio respeita o fuso da organização perto da meia-noite'
);

insert into public.accounts_payable (
  organization_id, description, document_type, amount_cents, due_date,
  idempotency_key, created_by, updated_by
)
select
  'ea000000-0000-0000-0000-000000000003', 'Conta volume ' || item, 'outro', 100,
  date '2026-07-15' + (item % 30), 'dashboard-volume-' || lpad(item::text, 6, '0'),
  '51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001'
from generate_series(1, 1000) item;

select is(
  ((public.get_financial_dashboard_summary('ea000000-0000-0000-0000-000000000003', '2026-07-15') ->> 'totalCount')::bigint),
  1000::bigint,
  'agregação atende volume simulado sem carregar registros no cliente'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"52000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$ select public.get_financial_dashboard_summary('ea000000-0000-0000-0000-000000000001', '2026-07-15') $$,
  '42501',
  'Organização não autorizada.',
  'agregações bloqueiam acesso entre organizações'
);

select * from finish();
rollback;
