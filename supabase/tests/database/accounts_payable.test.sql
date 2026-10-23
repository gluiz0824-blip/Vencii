begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(20);

insert into auth.users (id, email)
values
  ('31000000-0000-0000-0000-000000000001', 'owner-payables@vencii.test'),
  ('31000000-0000-0000-0000-000000000002', 'operator-payables@vencii.test'),
  ('31000000-0000-0000-0000-000000000003', 'viewer-payables@vencii.test'),
  ('32000000-0000-0000-0000-000000000001', 'owner-other@vencii.test');

insert into public.organizations (id, legal_name, trade_name, owner_id)
values
  ('ca000000-0000-0000-0000-000000000001', 'Contas A Ltda', 'Contas A', '31000000-0000-0000-0000-000000000001'),
  ('cb000000-0000-0000-0000-000000000001', 'Contas B Ltda', 'Contas B', '32000000-0000-0000-0000-000000000001');

insert into public.organization_members (organization_id, user_id, role, status, joined_at)
values
  ('ca000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('ca000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000002', 'operator', 'active', now()),
  ('ca000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000003', 'viewer', 'active', now()),
  ('cb000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'owner', 'active', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"31000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.accounts_payable (
    id, organization_id, description, document_type, amount_cents, due_date,
    status, paid_date, idempotency_key, created_by, updated_by
  ) values (
    'ac000000-0000-0000-0000-000000000001',
    'ca000000-0000-0000-0000-000000000001',
    'Conta pendente', 'boleto', 10000, '2026-07-01', 'pending', null,
    'owner-create-00000001',
    '31000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000001'
  ), (
    'ac000000-0000-0000-0000-000000000002',
    'ca000000-0000-0000-0000-000000000001',
    'Conta paga', 'pix', 20000, '2026-06-01', 'paid', '2026-06-01',
    'owner-paid-000000001',
    '31000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000001'
  ), (
    'ac000000-0000-0000-0000-000000000004',
    'ca000000-0000-0000-0000-000000000001',
    'Conta para pagamento', 'boleto', 30000, '2026-07-15', 'pending', null,
    'owner-payment-000001',
    '31000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000001'
  ) $$,
  'owner cadastra uma conta simples'
);

select throws_ok(
  $$ insert into public.accounts_payable (
    organization_id, description, document_type, amount_cents, due_date,
    idempotency_key, created_by, updated_by
  ) values (
    'ca000000-0000-0000-0000-000000000001',
    'Reenvio', 'boleto', 10000, '2026-07-01', 'owner-create-00000001',
    '31000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000001'
  ) $$,
  '23505',
  null,
  'chave idempotente impede duplicação por reenvio'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"32000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (select count(*) from public.accounts_payable where organization_id = 'ca000000-0000-0000-0000-000000000001'),
  0::bigint,
  'outra organização não acessa a conta'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"31000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.accounts_payable (
    id, organization_id, description, document_type, amount_cents, due_date,
    status, idempotency_key, created_by, updated_by
  ) values (
    'ac000000-0000-0000-0000-000000000003',
    'ca000000-0000-0000-0000-000000000001',
    'Conta do operador', 'pix', 20000, '2026-08-01', 'pending', 'operator-create-0001',
    '31000000-0000-0000-0000-000000000002',
    '31000000-0000-0000-0000-000000000002'
  ) $$,
  'operator cadastra conta pendente'
);

select throws_ok(
  $$ update public.accounts_payable
     set status = 'approved', updated_by = '31000000-0000-0000-0000-000000000002'
     where id = 'ac000000-0000-0000-0000-000000000003' $$,
  '42501',
  'O papel operator não pode definir estados de decisão ou pagamento.',
  'operator não aprova contas'
);

select throws_ok(
  $$ select public.mark_account_payable_paid(
    'ca000000-0000-0000-0000-000000000001',
    'ac000000-0000-0000-0000-000000000004',
    '2026-07-15',
    'Tentativa do operador'
  ) $$,
  '42501',
  'Somente owner ou admin pode registrar um pagamento.',
  'operator não registra pagamento'
);

select throws_ok(
  $$ update public.accounts_payable
     set amount_cents = 25000, updated_by = '31000000-0000-0000-0000-000000000002'
     where id = 'ac000000-0000-0000-0000-000000000002' $$,
  '42501',
  'Conta finalizada permite alterar somente observações.',
  'valor de conta paga fica bloqueado'
);

select lives_ok(
  $$ update public.accounts_payable
     set notes = 'Observação permitida', updated_by = '31000000-0000-0000-0000-000000000002'
     where id = 'ac000000-0000-0000-0000-000000000002' $$,
  'observações de conta paga podem ser atualizadas'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"31000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

select throws_ok(
  $$ insert into public.accounts_payable (
    organization_id, description, document_type, amount_cents, due_date,
    idempotency_key, created_by, updated_by
  ) values (
    'ca000000-0000-0000-0000-000000000001',
    'Conta do viewer', 'outro', 5000, '2026-08-01', 'viewer-attempt-000001',
    '31000000-0000-0000-0000-000000000003',
    '31000000-0000-0000-0000-000000000003'
  ) $$,
  '42501',
  null,
  'viewer não cadastra conta'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"31000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$ update public.accounts_payable
     set status = 'paid', paid_date = '2026-07-15',
         updated_by = '31000000-0000-0000-0000-000000000001'
     where id = 'ac000000-0000-0000-0000-000000000004' $$,
  '42501',
  'Use o fluxo de registro de pagamento.',
  'alteração direta para pago é bloqueada'
);

select lives_ok(
  $$ select public.mark_account_payable_paid(
    'ca000000-0000-0000-0000-000000000001',
    'ac000000-0000-0000-0000-000000000004',
    '2026-07-15',
    'Pago por transferência'
  ) $$,
  'owner registra pagamento'
);

select results_eq(
  $$ select status::text, paid_date::text, payment_notes
     from public.accounts_payable
     where id = 'ac000000-0000-0000-0000-000000000004' $$,
  $$ values ('paid', '2026-07-15', 'Pago por transferência') $$,
  'pagamento salva status, data e observação'
);

select is(
  (
    select count(*) from public.audit_logs
    where entity_type = 'accounts_payable'
      and entity_id = 'ac000000-0000-0000-0000-000000000004'
  ),
  2::bigint,
  'registro de pagamento gera auditoria'
);

select lives_ok(
  $$ select public.mark_account_payable_paid(
    'ca000000-0000-0000-0000-000000000001',
    'ac000000-0000-0000-0000-000000000004',
    '2026-07-15',
    'Reenvio'
  ) $$,
  'reenvio do registro é idempotente'
);

select is(
  (
    select count(*) from public.audit_logs
    where entity_type = 'accounts_payable'
      and entity_id = 'ac000000-0000-0000-0000-000000000004'
  ),
  2::bigint,
  'reenvio não duplica a auditoria'
);

select throws_ok(
  $$ select public.cancel_account_payable(
    'ca000000-0000-0000-0000-000000000001',
    'ac000000-0000-0000-0000-000000000001',
    ''
  ) $$,
  '22023',
  'Informe um motivo de cancelamento entre 3 e 500 caracteres.',
  'cancelamento exige motivo'
);

select lives_ok(
  $$ select public.cancel_account_payable(
    'ca000000-0000-0000-0000-000000000001',
    'ac000000-0000-0000-0000-000000000001',
    'Documento emitido incorretamente'
  ) $$,
  'cancelamento autorizado é registrado'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where organization_id = 'ca000000-0000-0000-0000-000000000001'
      and entity_type = 'accounts_payable'
      and entity_id = 'ac000000-0000-0000-0000-000000000001'
  ),
  2::bigint,
  'cadastro e cancelamento geram histórico'
);

select is(
  public.mark_overdue_accounts('ca000000-0000-0000-0000-000000000001', '2026-08-01'),
  0,
  'atualização de vencidas não sobrescreve paga ou cancelada'
);

select results_eq(
  $$ select id
     from public.accounts_payable
     where organization_id = 'ca000000-0000-0000-0000-000000000001'
       and status = 'pending'
       and due_date between '2026-08-01' and '2026-08-31'
     order by due_date, id
     limit 1 offset 0 $$,
  $$ values ('ac000000-0000-0000-0000-000000000003'::uuid) $$,
  'filtros, ordenação e paginação retornam o registro esperado'
);

select * from finish();
rollback;
