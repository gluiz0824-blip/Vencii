begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(19);

insert into auth.users (id, email)
values
  ('61000000-0000-0000-0000-000000000001', 'owner-approval@vencii.test'),
  ('61000000-0000-0000-0000-000000000002', 'operator-approval@vencii.test'),
  ('61000000-0000-0000-0000-000000000003', 'approver-one@vencii.test'),
  ('61000000-0000-0000-0000-000000000004', 'approver-two@vencii.test'),
  ('62000000-0000-0000-0000-000000000001', 'owner-approval-other@vencii.test');

insert into public.organizations (id, legal_name, trade_name, owner_id)
values
  ('fa000000-0000-0000-0000-000000000001', 'Aprovações A Ltda', 'Aprovações A', '61000000-0000-0000-0000-000000000001'),
  ('fb000000-0000-0000-0000-000000000001', 'Aprovações B Ltda', 'Aprovações B', '62000000-0000-0000-0000-000000000001');

insert into public.organization_members (organization_id, user_id, role, status, joined_at)
values
  ('fa000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('fa000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', 'operator', 'active', now()),
  ('fa000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000003', 'approver', 'active', now()),
  ('fa000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000004', 'approver', 'active', now()),
  ('fb000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', 'owner', 'active', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into public.suppliers (id, organization_id, name)
values ('6a000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000001', 'Fornecedor específico');

insert into public.approval_rules (
  id, organization_id, name, min_amount_cents, required_approvals, priority
)
values (
  '6b000000-0000-0000-0000-000000000001',
  'fa000000-0000-0000-0000-000000000001',
  'Faixa acima de cem reais', 10000, 1, 100
);

insert into public.approval_rules (
  id, organization_id, name, supplier_id, required_approvals, priority
)
values (
  '6b000000-0000-0000-0000-000000000002',
  'fa000000-0000-0000-0000-000000000001',
  'Fornecedor com decisão dupla',
  '6a000000-0000-0000-0000-000000000001', 2, 1
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

insert into public.accounts_payable (
  id, organization_id, supplier_id, description, document_type, amount_cents,
  due_date, idempotency_key, created_by, updated_by
)
values
  ('6c000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000001', '6a000000-0000-0000-0000-000000000001', 'Conta com regra específica', 'boleto', 50000, '2026-07-20', 'approval-account-0001', '61000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000002'),
  ('6c000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000001', null, 'Conta por faixa de valor', 'pix', 20000, '2026-07-21', 'approval-account-0002', '61000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000002'),
  ('6c000000-0000-0000-0000-000000000003', 'fa000000-0000-0000-0000-000000000001', null, 'Conta para rejeição', 'outro', 5000, '2026-07-22', 'approval-account-0003', '61000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000002');

select public.request_payable_approval(
  'fa000000-0000-0000-0000-000000000001',
  '6c000000-0000-0000-0000-000000000003'
);

select results_eq(
  $$ select rule_id, required_approvals from public.payable_approval_requests
     where account_payable_id = '6c000000-0000-0000-0000-000000000001' and status = 'pending' $$,
  $$ values ('6b000000-0000-0000-0000-000000000002'::uuid, 2) $$,
  'regra mais específica prevalece sobre regra com maior prioridade'
);

select results_eq(
  $$ select rule_id, required_approvals from public.payable_approval_requests
     where account_payable_id = '6c000000-0000-0000-0000-000000000002' and status = 'pending' $$,
  $$ values ('6b000000-0000-0000-0000-000000000001'::uuid, 1) $$,
  'regra por faixa de valor é aplicada automaticamente'
);

select is(
  (select status::text from public.accounts_payable where id = '6c000000-0000-0000-0000-000000000001'),
  'awaiting_approval',
  'conta com regra fica aguardando aprovação'
);

select throws_ok(
  $$ select public.decide_payable_approval(
    'fa000000-0000-0000-0000-000000000001',
    (select id from public.payable_approval_requests where account_payable_id = '6c000000-0000-0000-0000-000000000001' and status = 'pending'),
    'approved', null
  ) $$,
  '42501',
  'Sem permissão para decidir esta aprovação.',
  'operator não decide aprovações'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

select is(
  public.decide_payable_approval(
    'fa000000-0000-0000-0000-000000000001',
    (select id from public.payable_approval_requests where account_payable_id = '6c000000-0000-0000-0000-000000000001' and status = 'pending'),
    'approved', 'Primeira análise concluída'
  )::text,
  'pending',
  'primeira de duas aprovações mantém solicitação pendente'
);

select throws_ok(
  $$ select public.decide_payable_approval(
    'fa000000-0000-0000-0000-000000000001',
    (select id from public.payable_approval_requests where account_payable_id = '6c000000-0000-0000-0000-000000000001' and status = 'pending'),
    'approved', 'Repetida'
  ) $$,
  '23505',
  'Você já decidiu esta solicitação.',
  'unicidade impede o mesmo aprovador de decidir duas vezes'
);

select throws_ok(
  $$ select public.decide_payable_approval(
    'fa000000-0000-0000-0000-000000000001',
    (select id from public.payable_approval_requests where account_payable_id = '6c000000-0000-0000-0000-000000000003' and status = 'pending'),
    'rejected', ''
  ) $$,
  '22023',
  'A rejeição exige uma justificativa.',
  'rejeição sem justificativa é bloqueada'
);

select is(
  public.decide_payable_approval(
    'fa000000-0000-0000-0000-000000000001',
    (select id from public.payable_approval_requests where account_payable_id = '6c000000-0000-0000-0000-000000000003' and status = 'pending'),
    'rejected', 'Documento divergente do pedido'
  )::text,
  'rejected',
  'rejeição justificada conclui a solicitação'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000004","role":"authenticated"}', true);

select is(
  public.decide_payable_approval(
    'fa000000-0000-0000-0000-000000000001',
    (select id from public.payable_approval_requests where account_payable_id = '6c000000-0000-0000-0000-000000000001' and status = 'pending'),
    'approved', 'Segunda análise concluída'
  )::text,
  'approved',
  'segundo aprovador conclui a aprovação múltipla'
);

select is(
  (select status::text from public.accounts_payable where id = '6c000000-0000-0000-0000-000000000001'),
  'approved',
  'conta recebe estado aprovado somente após atingir o total necessário'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

update public.accounts_payable
set amount_cents = 51000, updated_by = '61000000-0000-0000-0000-000000000002'
where id = '6c000000-0000-0000-0000-000000000001';

select results_eq(
  $$ select
       count(*) filter (where status = 'invalidated')::bigint,
       count(*) filter (where status = 'pending')::bigint
     from public.payable_approval_requests
     where account_payable_id = '6c000000-0000-0000-0000-000000000001' $$,
  $$ values (1::bigint, 1::bigint) $$,
  'alteração financeira invalida a aprovação e gera nova solicitação'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into public.accounts_payable (
  id, organization_id, description, document_type, amount_cents, due_date,
  idempotency_key, created_by, updated_by
) values (
  '6c000000-0000-0000-0000-000000000004',
  'fa000000-0000-0000-0000-000000000001',
  'Conta criada pelo owner', 'outro', 5000, '2026-07-25', 'approval-account-0004',
  '61000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001'
);
select public.request_payable_approval('fa000000-0000-0000-0000-000000000001', '6c000000-0000-0000-0000-000000000004');

select throws_ok(
  $$ select public.decide_payable_approval(
    'fa000000-0000-0000-0000-000000000001',
    (select id from public.payable_approval_requests where account_payable_id = '6c000000-0000-0000-0000-000000000004' and status = 'pending'),
    'approved', null
  ) $$,
  '42501',
  'Quem criou a conta não pode aprová-la.',
  'autoaprovação é bloqueada por padrão'
);

update public.organizations set allow_self_approval = true
where id = 'fa000000-0000-0000-0000-000000000001';

select is(
  public.decide_payable_approval(
    'fa000000-0000-0000-0000-000000000001',
    (select id from public.payable_approval_requests where account_payable_id = '6c000000-0000-0000-0000-000000000004' and status = 'pending'),
    'approved', 'Autoaprovação autorizada pela organização'
  )::text,
  'approved',
  'configuração explícita permite autoaprovação'
);

select throws_ok(
  $$ select public.mark_account_payable_paid(
    'fa000000-0000-0000-0000-000000000001',
    '6c000000-0000-0000-0000-000000000002',
    '2026-07-15', null
  ) $$,
  'P0001',
  'A conta precisa ser aprovada antes do registro de pagamento.',
  'pagamento é bloqueado enquanto aprovação obrigatória está pendente'
);

select ok(
  (select count(*) from public.notifications where organization_id = 'fa000000-0000-0000-0000-000000000001') > 0,
  'solicitações e decisões geram notificações internas'
);

select ok(
  (select count(*) from public.audit_logs
   where organization_id = 'fa000000-0000-0000-0000-000000000001'
     and entity_type in ('payable_approval_requests', 'payable_approvals')) >= 8,
  'solicitações e decisões são registradas no audit log'
);

select col_is_unique(
  'public', 'payable_approvals', array['request_id', 'approver_id'],
  'restrição única protege decisões concorrentes do mesmo aprovador'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"62000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$ select public.decide_payable_approval(
    'fa000000-0000-0000-0000-000000000001',
    (select id from public.payable_approval_requests where account_payable_id = '6c000000-0000-0000-0000-000000000001' and status = 'pending'),
    'approved', null
  ) $$,
  '42501',
  'Sem permissão para decidir esta aprovação.',
  'usuário de outra organização não decide a solicitação'
);

select is(
  (select count(*) from public.payable_approval_requests where organization_id = 'fa000000-0000-0000-0000-000000000001'),
  0::bigint,
  'RLS impede leitura de solicitações de outra organização'
);

select * from finish();
rollback;
