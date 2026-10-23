begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

insert into auth.users (id, email)
values
  ('41000000-0000-0000-0000-000000000001', 'owner-files-a@vencii.test'),
  ('41000000-0000-0000-0000-000000000002', 'operator-files-a@vencii.test'),
  ('41000000-0000-0000-0000-000000000003', 'viewer-files-a@vencii.test'),
  ('42000000-0000-0000-0000-000000000001', 'owner-files-b@vencii.test');

insert into public.organizations (id, legal_name, trade_name, owner_id)
values
  ('da000000-0000-0000-0000-000000000001', 'Arquivos A Ltda', 'Arquivos A', '41000000-0000-0000-0000-000000000001'),
  ('db000000-0000-0000-0000-000000000001', 'Arquivos B Ltda', 'Arquivos B', '42000000-0000-0000-0000-000000000001');

insert into public.organization_members (organization_id, user_id, role, status, joined_at)
values
  ('da000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('da000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002', 'operator', 'active', now()),
  ('da000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000003', 'viewer', 'active', now()),
  ('db000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', 'owner', 'active', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"41000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.payable_attachments (
    id, organization_id, storage_path, original_name, mime_type, size_bytes,
    sha256, uploaded_by
  ) values (
    'ad000000-0000-0000-0000-000000000001',
    'da000000-0000-0000-0000-000000000001',
    'da000000-0000-0000-0000-000000000001/unassigned/documento.pdf',
    'boleto.pdf', 'application/pdf', 100,
    repeat('a', 64), '41000000-0000-0000-0000-000000000002'
  ) $$,
  'operator cadastra metadados do documento'
);

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
  values (
    'payable-documents',
    'da000000-0000-0000-0000-000000000001/unassigned/documento.pdf',
    '41000000-0000-0000-0000-000000000002',
    '41000000-0000-0000-0000-000000000002',
    '{"mimetype":"application/pdf","size":100}'::jsonb
  ) $$,
  'operator autorizado grava o objeto privado vinculado'
);

select ok(
  public.claim_attachment_extraction(
    'da000000-0000-0000-0000-000000000001',
    'ad000000-0000-0000-0000-000000000001'
  ),
  'primeira tentativa reivindica o processamento'
);

select is(
  public.claim_attachment_extraction(
    'da000000-0000-0000-0000-000000000001',
    'ad000000-0000-0000-0000-000000000001'
  ),
  false,
  'reenvio durante processamento é idempotente'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"42000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (select count(*) from public.payable_attachments where id = 'ad000000-0000-0000-0000-000000000001'),
  0::bigint,
  'outra organização não lê metadados do documento'
);

select is(
  (
    select count(*) from storage.objects
    where bucket_id = 'payable-documents'
      and name = 'da000000-0000-0000-0000-000000000001/unassigned/documento.pdf'
  ),
  0::bigint,
  'outra organização não acessa o arquivo privado'
);

select throws_ok(
  $$ select public.claim_attachment_extraction(
    'da000000-0000-0000-0000-000000000001',
    'ad000000-0000-0000-0000-000000000001'
  ) $$,
  '42501',
  'Sem permissão para processar este documento.',
  'outra organização não processa o documento'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"41000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

select throws_ok(
  $$ insert into public.payable_attachments (
    organization_id, storage_path, original_name, mime_type, size_bytes, sha256, uploaded_by
  ) values (
    'da000000-0000-0000-0000-000000000001',
    'da000000-0000-0000-0000-000000000001/unassigned/viewer.pdf',
    'viewer.pdf', 'application/pdf', 100, repeat('b', 64),
    '41000000-0000-0000-0000-000000000003'
  ) $$,
  '42501',
  null,
  'viewer não envia documento'
);

select * from finish();
rollback;
