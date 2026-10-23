begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(7);

insert into auth.users(id,email) values
('a1000000-0000-0000-0000-000000000001','reports-a@vencii.test'),
('a2000000-0000-0000-0000-000000000001','reports-b@vencii.test');
update public.profiles set full_name=case id
  when 'a1000000-0000-0000-0000-000000000001' then 'Responsável São José'
  else 'Responsável B' end
where id in ('a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001');
insert into public.organizations(id,legal_name,trade_name,timezone,owner_id,allow_partial_payments) values
('aa000000-0000-0000-0000-000000000001','Relatórios A Ltda','Relatórios A','America/Sao_Paulo','a1000000-0000-0000-0000-000000000001',true),
('ab000000-0000-0000-0000-000000000001','Relatórios B Ltda','Relatórios B','America/Sao_Paulo','a2000000-0000-0000-0000-000000000001',true);
insert into public.organization_members(organization_id,user_id,role,status,joined_at) values
('aa000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','owner','active',now()),
('ab000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','owner','active',now());
insert into public.suppliers(id,organization_id,name) values
('ac000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000001','Fornecedor Açúcar'),
('ac000000-0000-0000-0000-000000000002','aa000000-0000-0000-0000-000000000001','Fornecedor Dois');
insert into public.expense_categories(id,organization_id,name) values
('ad000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000001','Serviços'),
('ad000000-0000-0000-0000-000000000002','aa000000-0000-0000-0000-000000000001','Insumos');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
insert into public.accounts_payable(id,organization_id,supplier_id,expense_category_id,description,document_type,amount_cents,due_date,status,idempotency_key,created_by,updated_by,cancellation_reason) values
('ae000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000001','ac000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000001','Conta paga','boleto',10000,'2026-08-10','pending','reports-account-key-0001','a1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001',null),
('ae000000-0000-0000-0000-000000000002','aa000000-0000-0000-0000-000000000001','ac000000-0000-0000-0000-000000000002','ad000000-0000-0000-0000-000000000002','Conta prevista','pix',20000,'2026-08-15','pending','reports-account-key-0002','a1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001',null),
('ae000000-0000-0000-0000-000000000003','aa000000-0000-0000-0000-000000000001','ac000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000001','Conta cancelada','outro',30000,'2026-08-20','canceled','reports-account-key-0003','a1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','Cancelada no teste');
select public.register_account_payment('aa000000-0000-0000-0000-000000000001','ae000000-0000-0000-0000-000000000001',10000,'2026-08-10 15:00:00+00','pix',null,null,'reports-payment-key-0001',false);

select is(((public.get_management_report('aa000000-0000-0000-0000-000000000001','2026-08-01','2026-08-31','forecast','2026-08-10')->'summary'->>'predictedCents')::bigint),30000::bigint,'previsto exclui canceladas e rejeitadas por padrão');
select is(((public.get_management_report('aa000000-0000-0000-0000-000000000001','2026-08-01','2026-08-31','paid','2026-08-10')->'summary'->>'realizedCents')::bigint),((public.get_financial_dashboard_summary('aa000000-0000-0000-0000-000000000001','2026-08-10')->>'paidThisMonthCents')::bigint),'realizado do relatório é consistente com o Dashboard');
select is(((public.get_management_report('aa000000-0000-0000-0000-000000000001','2026-08-01','2026-08-31','forecast','2026-08-10',null,'ac000000-0000-0000-0000-000000000002','ad000000-0000-0000-0000-000000000002')->'summary'->>'totalCount')::bigint),1::bigint,'filtros combinados de fornecedor e categoria funcionam');
select is(((public.get_management_report('aa000000-0000-0000-0000-000000000001','2026-08-01','2026-08-31','forecast','2026-08-10','canceled')->'summary'->>'predictedCents')::bigint),30000::bigint,'filtro explícito inclui canceladas');
select is(((public.get_management_report('aa000000-0000-0000-0000-000000000001','2025-01-01','2025-01-31','forecast','2026-08-10')->'summary'->>'totalCount')::bigint),0::bigint,'relatório sem dados retorna resultado vazio');

reset role;set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.get_management_report('aa000000-0000-0000-0000-000000000001','2026-08-01','2026-08-31')$$,'42501','Organização não autorizada.','outra organização não acessa o relatório');

reset role;set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
insert into public.accounts_payable(organization_id,description,document_type,amount_cents,due_date,status,idempotency_key,created_by,updated_by)
select 'aa000000-0000-0000-0000-000000000001','Volume '||item,'outro',100,'2026-09-10','pending','reports-volume-'||lpad(item::text,6,'0'),'a1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001' from generate_series(1,1000)item;
select is(((public.get_management_report('aa000000-0000-0000-0000-000000000001','2026-09-01','2026-09-30','forecast','2026-08-10')->'summary'->>'totalCount')::bigint),1000::bigint,'agregação suporta volume elevado sem carregar tudo na página');
select * from finish();rollback;
