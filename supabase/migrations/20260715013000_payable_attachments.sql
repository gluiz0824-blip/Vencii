create type public.payable_attachment_type as enum (
  'boleto',
  'invoice',
  'tax_document',
  'receipt',
  'other'
);

create type public.attachment_extraction_status as enum (
  'uploaded',
  'processing',
  'needs_review',
  'completed',
  'failed'
);

create table public.payable_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_payable_id uuid references public.accounts_payable (id) on delete set null,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  attachment_type public.payable_attachment_type not null default 'boleto',
  extraction_status public.attachment_extraction_status not null default 'uploaded',
  extraction_data jsonb,
  duplicate_of_attachment_id uuid references public.payable_attachments (id) on delete set null,
  processing_attempts smallint not null default 0,
  last_error text,
  uploaded_by uuid not null references auth.users (id) on delete restrict,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payable_attachments_original_name_length check (char_length(original_name) between 1 and 255),
  constraint payable_attachments_storage_path_length check (char_length(storage_path) between 20 and 700),
  constraint payable_attachments_mime_type check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  constraint payable_attachments_size check (size_bytes between 1 and 10485760),
  constraint payable_attachments_sha256 check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint payable_attachments_processing_attempts check (processing_attempts between 0 and 3),
  constraint payable_attachments_last_error_length check (last_error is null or char_length(last_error) <= 500),
  constraint payable_attachments_extraction_data_object check (
    extraction_data is null or jsonb_typeof(extraction_data) = 'object'
  )
);

create index payable_attachments_organization_created_idx
  on public.payable_attachments (organization_id, created_at desc);
create index payable_attachments_account_idx
  on public.payable_attachments (organization_id, account_payable_id, created_at desc);
create index payable_attachments_sha256_idx
  on public.payable_attachments (organization_id, sha256, created_at desc);
create index payable_attachments_extraction_status_idx
  on public.payable_attachments (organization_id, extraction_status, created_at);

alter table public.payable_attachments enable row level security;

create policy payable_attachments_select_active_member
on public.payable_attachments for select to authenticated
using ((select private.is_active_member(organization_id)));

create policy payable_attachments_insert_operator
on public.payable_attachments for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and extraction_status = 'uploaded'
  and processing_attempts = 0
  and (select private.has_organization_role(
    organization_id,
    array['owner', 'admin', 'operator']::public.organization_role[]
  ))
);

create policy payable_attachments_delete_operator
on public.payable_attachments for delete to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['owner', 'admin', 'operator']::public.organization_role[]
)));

grant select, insert, delete on public.payable_attachments to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payable-documents',
  'payable-documents',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy payable_documents_select_authorized_attachment
on storage.objects for select to authenticated
using (
  bucket_id = 'payable-documents'
  and exists (
    select 1
    from public.payable_attachments attachment
    where attachment.storage_path = name
      and private.is_active_member(attachment.organization_id)
  )
);

create policy payable_documents_insert_authorized_attachment
on storage.objects for insert to authenticated
with check (
  bucket_id = 'payable-documents'
  and exists (
    select 1
    from public.payable_attachments attachment
    where attachment.storage_path = name
      and attachment.uploaded_by = auth.uid()
      and private.has_organization_role(
        attachment.organization_id,
        array['owner', 'admin', 'operator']::public.organization_role[]
      )
  )
);

create policy payable_documents_delete_authorized_attachment
on storage.objects for delete to authenticated
using (
  bucket_id = 'payable-documents'
  and exists (
    select 1
    from public.payable_attachments attachment
    where attachment.storage_path = name
      and private.has_organization_role(
        attachment.organization_id,
        array['owner', 'admin', 'operator']::public.organization_role[]
      )
  )
);

create trigger payable_attachments_set_updated_at
before update on public.payable_attachments
for each row execute function private.set_updated_at();

create or replace function private.protect_payable_attachment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_prefix text;
begin
  if tg_op = 'INSERT' then
    expected_prefix := new.organization_id::text || '/' || coalesce(new.account_payable_id::text, 'unassigned') || '/';
    if left(new.storage_path, char_length(expected_prefix)) <> expected_prefix
      or new.storage_path like '%..%' then
      raise exception 'Caminho de armazenamento inválido.' using errcode = '22023';
    end if;
    if new.uploaded_by <> auth.uid() then
      raise exception 'O autor do upload deve ser o usuário autenticado.' using errcode = '42501';
    end if;
  else
    if new.organization_id <> old.organization_id
      or new.storage_path <> old.storage_path
      or new.original_name <> old.original_name
      or new.mime_type <> old.mime_type
      or new.size_bytes <> old.size_bytes
      or new.sha256 <> old.sha256
      or new.uploaded_by <> old.uploaded_by
      or new.created_at <> old.created_at then
      raise exception 'Metadados originais do anexo são imutáveis.' using errcode = '42501';
    end if;
  end if;

  if new.account_payable_id is not null and not exists (
    select 1 from public.accounts_payable account
    where account.id = new.account_payable_id
      and account.organization_id = new.organization_id
  ) then
    raise exception 'A conta não pertence à organização.' using errcode = '23503';
  end if;

  return new;
end;
$$;

create trigger payable_attachments_protect
before insert or update on public.payable_attachments
for each row execute function private.protect_payable_attachment();

create trigger payable_attachments_audit
after insert or update or delete on public.payable_attachments
for each row execute function private.write_audit_log();

create or replace function public.claim_attachment_extraction(
  p_organization_id uuid,
  p_attachment_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  if auth.uid() is null or not private.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'operator']::public.organization_role[],
    auth.uid()
  ) then
    raise exception 'Sem permissão para processar este documento.' using errcode = '42501';
  end if;

  update public.payable_attachments
  set extraction_status = 'processing',
      processing_attempts = processing_attempts + 1,
      last_error = null
  where id = p_attachment_id
    and organization_id = p_organization_id
    and extraction_status in ('uploaded', 'failed')
    and processing_attempts < 3;

  claimed := found;
  return claimed;
end;
$$;

create or replace function public.finish_attachment_extraction(
  p_organization_id uuid,
  p_attachment_id uuid,
  p_status public.attachment_extraction_status,
  p_extraction_data jsonb,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'operator']::public.organization_role[],
    auth.uid()
  ) then
    raise exception 'Sem permissão para concluir a extração.' using errcode = '42501';
  end if;
  if p_status not in ('needs_review', 'failed') then
    raise exception 'Estado final de extração inválido.' using errcode = '22023';
  end if;

  update public.payable_attachments
  set extraction_status = p_status,
      extraction_data = p_extraction_data,
      last_error = case when p_status = 'failed' then left(coalesce(p_error, 'Falha na extração.'), 500) else null end,
      processed_at = now()
  where id = p_attachment_id
    and organization_id = p_organization_id
    and extraction_status = 'processing';

  if not found then
    raise exception 'Documento não está em processamento.' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.review_payable_attachment(
  p_organization_id uuid,
  p_attachment_id uuid,
  p_account_payable_id uuid,
  p_review_data jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'operator']::public.organization_role[],
    auth.uid()
  ) then
    raise exception 'Sem permissão para revisar este documento.' using errcode = '42501';
  end if;
  if p_account_payable_id is not null and not exists (
    select 1 from public.accounts_payable account
    where account.id = p_account_payable_id and account.organization_id = p_organization_id
  ) then
    raise exception 'A conta não pertence à organização.' using errcode = '23503';
  end if;

  update public.payable_attachments
  set extraction_status = 'completed',
      extraction_data = jsonb_build_object(
        'original', extraction_data,
        'reviewed', p_review_data,
        'reviewed_at', now(),
        'reviewed_by', auth.uid()
      ),
      account_payable_id = p_account_payable_id,
      last_error = null,
      processed_at = now()
  where id = p_attachment_id
    and organization_id = p_organization_id
    and extraction_status in ('needs_review', 'completed');

  if not found then
    raise exception 'Documento ainda não está disponível para revisão.' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.claim_attachment_extraction(uuid, uuid) from public, anon;
revoke all on function public.finish_attachment_extraction(uuid, uuid, public.attachment_extraction_status, jsonb, text) from public, anon;
revoke all on function public.review_payable_attachment(uuid, uuid, uuid, jsonb) from public, anon;
grant execute on function public.claim_attachment_extraction(uuid, uuid) to authenticated;
grant execute on function public.finish_attachment_extraction(uuid, uuid, public.attachment_extraction_status, jsonb, text) to authenticated;
grant execute on function public.review_payable_attachment(uuid, uuid, uuid, jsonb) to authenticated;
