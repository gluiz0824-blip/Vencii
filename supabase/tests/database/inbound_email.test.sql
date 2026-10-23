begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(8);

insert into auth.users (id, email) values
  ('91000000-0000-0000-0000-000000000001', 'owner-inbound-a@vencii.test'),
  ('92000000-0000-0000-0000-000000000001', 'owner-inbound-b@vencii.test');
insert into public.organizations (id, legal_name, trade_name, owner_id) values
  ('9a000000-0000-0000-0000-000000000001', 'Entrada A Ltda', 'Entrada A', '91000000-0000-0000-0000-000000000001'),
  ('9b000000-0000-0000-0000-000000000001', 'Entrada B Ltda', 'Entrada B', '92000000-0000-0000-0000-000000000001');
insert into public.organization_members (organization_id, user_id, role, status, joined_at) values
  ('9a000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('9b000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 'owner', 'active', now());

select is((select count(*) from public.inbound_addresses where organization_id='9a000000-0000-0000-0000-000000000001' and active), 1::bigint, 'organização recebe um endereço ativo');
select ok((select local_part ~ '^contas\+[0-9a-f]{48}$' from public.inbound_addresses where organization_id='9a000000-0000-0000-0000-000000000001' and active), 'endereço usa token aleatório de 192 bits');

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok(format($sql$ select public.register_inbound_message('local','event-1',%L,'financeiro@fornecedor.test','Boleto','2026-08-10T12:00:00Z','{}','idempotency-inbound-event-0001') $sql$,
  (select local_part from public.inbound_addresses where organization_id='9a000000-0000-0000-0000-000000000001' and active)), 'webhook registra mensagem endereçada corretamente');
select is((select count(*) from public.inbound_messages where provider_message_id='event-1'), 1::bigint, 'mensagem é persistida uma vez');
select lives_ok(format($sql$ select public.register_inbound_message('local','event-1',%L,'financeiro@fornecedor.test','Boleto','2026-08-10T12:00:00Z','{}','idempotency-inbound-event-0001') $sql$,
  (select local_part from public.inbound_addresses where organization_id='9a000000-0000-0000-0000-000000000001' and active)), 'repetição do evento é idempotente');
select is((select count(*) from public.inbound_messages where provider_message_id='event-1'), 1::bigint, 'evento duplicado não cria nova mensagem');
select throws_ok($$ select public.register_inbound_message('local','event-invalid','contas+000000000000000000000000000000000000000000000000','x@y.test','X',now(),'{}','idempotency-inbound-invalid-0001') $$, 'P0002', 'Endereço de entrada inválido ou inativo.', 'endereço inválido é rejeitado');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"92000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*) from public.inbound_messages where provider_message_id='event-1'), 0::bigint, 'RLS isola mensagens de outra organização');
select * from finish();
rollback;
