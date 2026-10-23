begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(17);

insert into auth.users (id, email) values
  ('71000000-0000-0000-0000-000000000001', 'owner-payments-a@vencii.test'),
  ('72000000-0000-0000-0000-000000000001', 'owner-payments-b@vencii.test');

insert into public.organizations (id, legal_name, trade_name, owner_id) values
  ('ea000000-0000-0000-0000-000000000001', 'Pagamentos A Ltda', 'Pagamentos A', '71000000-0000-0000-0000-000000000001'),
  ('eb000000-0000-0000-0000-000000000001', 'Pagamentos B Ltda', 'Pagamentos B', '72000000-0000-0000-0000-000000000001');
insert into public.organization_members (organization_id, user_id, role, status, joined_at) values
  ('ea000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('eb000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'owner', 'active', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
insert into public.accounts_payable (
  id, organization_id, description, document_type, amount_cents, due_date,
  status, idempotency_key, created_by, updated_by
) values
  ('ea100000-0000-0000-0000-000000000001', 'ea000000-0000-0000-0000-000000000001', 'Pagamento integral', 'pix', 10000, '2099-07-20', 'pending', 'payment-account-key-001', '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001'),
  ('ea100000-0000-0000-0000-000000000002', 'ea000000-0000-0000-0000-000000000001', 'Pagamento parcial', 'boleto', 20000, '2099-07-20', 'pending', 'payment-account-key-002', '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001'),
  ('ea100000-0000-0000-0000-000000000003', 'ea000000-0000-0000-0000-000000000001', 'Pagamento com tolerância', 'outro', 10000, '2099-07-20', 'pending', 'payment-account-key-003', '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001');

select lives_ok(
  $$ select public.register_account_payment('ea000000-0000-0000-0000-000000000001', 'ea100000-0000-0000-0000-000000000001', 10000, now(), 'pix', 'E2E-001', null, 'payment-request-key-0001', false) $$,
  'pagamento integral é registrado'
);
select is((select status from public.accounts_payable where id = 'ea100000-0000-0000-0000-000000000001'), 'paid'::public.payable_status, 'pagamento integral quita a conta');
select is((select sum(paid_amount_cents) from public.payments where account_payable_id = 'ea100000-0000-0000-0000-000000000001' and reversed_at is null), 10000::numeric, 'soma ativa determina o total pago');
select lives_ok(
  $$ select public.register_account_payment('ea000000-0000-0000-0000-000000000001', 'ea100000-0000-0000-0000-000000000001', 10000, now(), 'pix', 'E2E-001', null, 'payment-request-key-0001', false) $$,
  'repetição da mesma requisição é idempotente'
);
select is((select count(*) from public.payments where account_payable_id = 'ea100000-0000-0000-0000-000000000001'), 1::bigint, 'duplo envio cria um único registro');

select throws_ok(
  $$ select public.register_account_payment('ea000000-0000-0000-0000-000000000001', 'ea100000-0000-0000-0000-000000000002', 5000, now(), 'boleto', null, null, 'payment-request-key-0002', false) $$,
  'P0001', 'Pagamentos parciais não estão habilitados para esta organização.', 'parcial fica bloqueado por padrão'
);
update public.organizations set allow_partial_payments = true where id = 'ea000000-0000-0000-0000-000000000001';
select lives_ok(
  $$ select public.register_account_payment('ea000000-0000-0000-0000-000000000001', 'ea100000-0000-0000-0000-000000000002', 5000, now(), 'boleto', null, null, 'payment-request-key-0002', false) $$,
  'parcial habilitado é registrado'
);
select is((select status from public.accounts_payable where id = 'ea100000-0000-0000-0000-000000000002'), 'partial'::public.payable_status, 'conta recebe status parcial');
select throws_ok(
  $$ select public.register_account_payment('ea000000-0000-0000-0000-000000000001', 'ea100000-0000-0000-0000-000000000003', 10050, now(), 'outro', null, null, 'payment-request-key-0003', true) $$,
  'P0001', 'O valor informado é maior que o saldo restante.', 'valor acima do saldo é bloqueado por padrão'
);
update public.organizations set allow_overpayments = true, overpayment_tolerance_cents = 100 where id = 'ea000000-0000-0000-0000-000000000001';
select throws_ok(
  $$ select public.register_account_payment('ea000000-0000-0000-0000-000000000001', 'ea100000-0000-0000-0000-000000000003', 10050, now(), 'outro', null, null, 'payment-request-key-0003', false) $$,
  'P0001', 'O valor informado é maior que o saldo restante.', 'valor acima do saldo exige confirmação explícita'
);
select lives_ok(
  $$ select public.register_account_payment('ea000000-0000-0000-0000-000000000001', 'ea100000-0000-0000-0000-000000000003', 10050, now(), 'outro', null, null, 'payment-request-key-0003', true) $$,
  'tolerância confirmada permite registro'
);

select lives_ok(
  $$ select public.reverse_account_payment('ea000000-0000-0000-0000-000000000001', (select id from public.payments where idempotency_key = 'payment-request-key-0001'), 'Pagamento registrado incorretamente') $$,
  'owner estorna pagamento com motivo'
);
select is((select status from public.accounts_payable where id = 'ea100000-0000-0000-0000-000000000001'), 'pending'::public.payable_status, 'estorno reabre a conta');
select ok((select reversed_at is not null and reversal_reason is not null from public.payments where idempotency_key = 'payment-request-key-0001'), 'estorno preserva o pagamento e seus metadados');

create temporary table payment_test_reference as
select id from public.payments where idempotency_key = 'payment-request-key-0003';

select throws_ok(
  $$ delete from public.accounts_payable where id = 'ea100000-0000-0000-0000-000000000002' $$,
  '42501', null, 'conta com pagamento não pode ser excluída'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"72000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*) from public.payments where organization_id = 'ea000000-0000-0000-0000-000000000001'), 0::bigint, 'outra organização não acessa pagamentos');
insert into public.accounts_payable (
  id, organization_id, description, document_type, amount_cents, due_date,
  status, idempotency_key, created_by, updated_by
) values (
  'eb100000-0000-0000-0000-000000000001', 'eb000000-0000-0000-0000-000000000001',
  'Conta da organização B', 'outro', 10000, '2099-07-20', 'pending',
  'payment-account-key-b01', '72000000-0000-0000-0000-000000000001',
  '72000000-0000-0000-0000-000000000001'
);
select throws_ok(
  $$ insert into public.payable_attachments (organization_id, account_payable_id, payment_id, storage_path, original_name, mime_type, size_bytes, sha256, attachment_type, uploaded_by)
     values ('eb000000-0000-0000-0000-000000000001', 'eb100000-0000-0000-0000-000000000001', (select id from payment_test_reference), 'eb000000-0000-0000-0000-000000000001/eb100000-0000-0000-0000-000000000001/comprovante.pdf', 'comprovante.pdf', 'application/pdf', 100, repeat('d', 64), 'receipt', '72000000-0000-0000-0000-000000000001') $$,
  '23503', 'O pagamento não pertence à conta e à organização informadas.', 'comprovante de outra organização é bloqueado'
);

select * from finish();
rollback;
