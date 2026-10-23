begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(6);

insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000001', 'owner-a@vencii.test'),
  ('10000000-0000-0000-0000-000000000002', 'operator-a@vencii.test'),
  ('10000000-0000-0000-0000-000000000003', 'viewer-a@vencii.test'),
  ('20000000-0000-0000-0000-000000000001', 'owner-b@vencii.test');

insert into public.organizations (id, legal_name, trade_name, owner_id)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    'Empresa A Ltda',
    'Empresa A',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    'b0000000-0000-0000-0000-000000000001',
    'Empresa B Ltda',
    'Empresa B',
    '20000000-0000-0000-0000-000000000001'
  );

insert into public.organization_members (
  organization_id,
  user_id,
  role,
  status,
  joined_at
)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'owner',
    'active',
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'operator',
    'active',
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'viewer',
    'active',
    now()
  ),
  (
    'b0000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'owner',
    'active',
    now()
  );

insert into public.organization_invitations (
  id,
  organization_id,
  email,
  role,
  token_hash,
  expires_at,
  accepted_at,
  invited_by
)
values
  (
    'a1000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'operator-a@vencii.test',
    'operator',
    encode(extensions.digest('expired-token', 'sha256'), 'hex'),
    now() - interval '1 minute',
    null,
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'operator-a@vencii.test',
    'operator',
    encode(extensions.digest('used-token', 'sha256'), 'hex'),
    now() + interval '1 day',
    now(),
    '10000000-0000-0000-0000-000000000001'
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","email":"operator-a@vencii.test","role":"authenticated"}',
  true
);

select results_eq(
  $$ select id from public.organizations order by id $$,
  $$ values ('a0000000-0000-0000-0000-000000000001'::uuid) $$,
  'membro ativo acessa a própria organização'
);

select is(
  (select count(*) from public.organizations where id = 'b0000000-0000-0000-0000-000000000001'),
  0::bigint,
  'membro não acessa outra organização'
);

update public.organization_members
set role = 'admin'
where organization_id = 'a0000000-0000-0000-0000-000000000001'
  and user_id = '10000000-0000-0000-0000-000000000003';

reset role;

select is(
  (
    select role::text
    from public.organization_members
    where organization_id = 'a0000000-0000-0000-0000-000000000001'
      and user_id = '10000000-0000-0000-0000-000000000003'
  ),
  'viewer',
  'operator não altera permissões'
);

set local role authenticated;

select throws_ok(
  $$ select public.accept_organization_invitation('expired-token') $$,
  'P0001',
  'Convite expirado.',
  'convite expirado é rejeitado'
);

select throws_ok(
  $$ select public.accept_organization_invitation('used-token') $$,
  'P0001',
  'Convite já utilizado.',
  'convite utilizado é rejeitado'
);

reset role;

select is(
  (
    select count(*)
    from public.organization_members
    where organization_id = 'a0000000-0000-0000-0000-000000000001'
      and user_id = '10000000-0000-0000-0000-000000000002'
  ),
  1::bigint,
  'falhas de convite não duplicam associação'
);

select * from finish();
rollback;
