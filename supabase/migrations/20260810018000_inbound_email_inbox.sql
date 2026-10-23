create type public.inbound_message_status as enum (
  'received', 'processing', 'needs_review', 'completed', 'failed', 'ignored', 'no_attachments'
);

create type public.inbound_attachment_status as enum (
  'pending', 'processing', 'needs_review', 'completed', 'failed', 'duplicate', 'ignored'
);

create table public.inbound_addresses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  local_part text not null unique,
  active boolean not null default true,
  rotated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint inbound_addresses_local_part_format check (
    local_part ~ '^contas\+[0-9a-f]{48}$'
  ),
  constraint inbound_addresses_rotation_consistent check (
    (active and rotated_at is null) or (not active and rotated_at is not null)
  )
);

create unique index inbound_addresses_one_active_per_organization
  on public.inbound_addresses (organization_id) where active;
create index inbound_addresses_organization_created_idx
  on public.inbound_addresses (organization_id, created_at desc);

create table public.inbound_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  inbound_address_id uuid not null references public.inbound_addresses (id) on delete restrict,
  provider text not null,
  provider_message_id text not null,
  sender_email text not null,
  subject text not null default '(sem assunto)',
  received_at timestamptz not null,
  status public.inbound_message_status not null default 'received',
  raw_metadata jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbound_messages_provider_length check (char_length(provider) between 1 and 40),
  constraint inbound_messages_provider_id_length check (char_length(provider_message_id) between 1 and 255),
  constraint inbound_messages_sender_length check (char_length(sender_email) between 3 and 320),
  constraint inbound_messages_subject_length check (char_length(subject) between 1 and 300),
  constraint inbound_messages_idempotency_length check (char_length(idempotency_key) between 16 and 255),
  constraint inbound_messages_metadata_object check (jsonb_typeof(raw_metadata) = 'object'),
  constraint inbound_messages_metadata_size check (octet_length(raw_metadata::text) <= 8192),
  constraint inbound_messages_error_length check (error_message is null or char_length(error_message) <= 500),
  unique (provider, provider_message_id),
  unique (organization_id, idempotency_key)
);

create index inbound_messages_organization_received_idx
  on public.inbound_messages (organization_id, received_at desc);
create index inbound_messages_organization_status_idx
  on public.inbound_messages (organization_id, status, received_at desc);

create table public.inbound_message_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  inbound_message_id uuid not null references public.inbound_messages (id) on delete cascade,
  attachment_id uuid references public.payable_attachments (id) on delete set null,
  provider_attachment_id text not null,
  original_name text not null,
  processing_status public.inbound_attachment_status not null default 'pending',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbound_message_attachments_provider_id_length check (char_length(provider_attachment_id) between 1 and 255),
  constraint inbound_message_attachments_name_length check (char_length(original_name) between 1 and 255),
  constraint inbound_message_attachments_error_length check (error_message is null or char_length(error_message) <= 500),
  unique (inbound_message_id, provider_attachment_id)
);

create index inbound_message_attachments_message_idx
  on public.inbound_message_attachments (inbound_message_id, created_at);
create index inbound_message_attachments_attachment_idx
  on public.inbound_message_attachments (attachment_id) where attachment_id is not null;

alter table public.inbound_addresses enable row level security;
alter table public.inbound_messages enable row level security;
alter table public.inbound_message_attachments enable row level security;

create policy inbound_addresses_select_active_member
on public.inbound_addresses for select to authenticated
using ((select private.is_active_member(organization_id)));

create policy inbound_messages_select_active_member
on public.inbound_messages for select to authenticated
using ((select private.is_active_member(organization_id)));

create policy inbound_message_attachments_select_active_member
on public.inbound_message_attachments for select to authenticated
using ((select private.is_active_member(organization_id)));

grant select on public.inbound_addresses, public.inbound_messages, public.inbound_message_attachments to authenticated;
grant select, insert, update, delete on public.inbound_addresses, public.inbound_messages, public.inbound_message_attachments to service_role;
grant select on public.organizations to service_role;
grant select, insert, update, delete on public.payable_attachments to service_role;

create trigger inbound_messages_set_updated_at before update on public.inbound_messages
for each row execute function private.set_updated_at();
create trigger inbound_message_attachments_set_updated_at before update on public.inbound_message_attachments
for each row execute function private.set_updated_at();

create or replace function private.new_inbound_local_part()
returns text language sql volatile security definer set search_path = ''
as $$ select 'contas+' || encode(extensions.gen_random_bytes(24), 'hex') $$;

create or replace function private.insert_inbound_address(p_organization_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare address_id uuid;
begin
  insert into public.inbound_addresses (organization_id, local_part)
  values (p_organization_id, private.new_inbound_local_part())
  returning id into address_id;
  return address_id;
end;
$$;

create or replace function private.organizations_default_inbound_address()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin perform private.insert_inbound_address(new.id); return new; end $$;

create trigger organizations_default_inbound_address
after insert on public.organizations for each row
execute function private.organizations_default_inbound_address();

do $$ declare organization_record record;
begin
  for organization_record in select id from public.organizations loop
    if not exists (select 1 from public.inbound_addresses where organization_id = organization_record.id and active) then
      perform private.insert_inbound_address(organization_record.id);
    end if;
  end loop;
end $$;

create or replace function public.rotate_inbound_address(p_organization_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare result text;
begin
  if auth.uid() is null or not private.has_organization_role(
    p_organization_id, array['owner', 'admin']::public.organization_role[], auth.uid()
  ) then raise exception 'Somente owner ou admin pode rotacionar o endereço.' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 4181));
  update public.inbound_addresses set active = false, rotated_at = now()
  where organization_id = p_organization_id and active;
  insert into public.inbound_addresses (organization_id, local_part)
  values (p_organization_id, private.new_inbound_local_part()) returning local_part into result;
  return result;
end;
$$;

create or replace function public.ignore_inbound_message(p_organization_id uuid, p_message_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_organization_role(
    p_organization_id, array['owner', 'admin', 'operator']::public.organization_role[], auth.uid()
  ) then raise exception 'Sem permissão para ignorar esta mensagem.' using errcode = '42501'; end if;
  update public.inbound_messages set status = 'ignored'
  where id = p_message_id and organization_id = p_organization_id and status not in ('completed', 'ignored');
  if not found then raise exception 'Mensagem não encontrada ou já concluída.' using errcode = 'P0002'; end if;
  update public.inbound_message_attachments set processing_status = 'ignored'
  where inbound_message_id = p_message_id and processing_status not in ('completed', 'ignored');
end;
$$;

create or replace function public.register_inbound_message(
  p_provider text, p_provider_message_id text, p_local_part text,
  p_sender_email text, p_subject text, p_received_at timestamptz,
  p_raw_metadata jsonb, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare address_record record; message_record record;
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso restrito ao webhook.' using errcode = '42501'; end if;
  select * into address_record from public.inbound_addresses where local_part = lower(p_local_part) and active;
  if address_record.id is null then raise exception 'Endereço de entrada inválido ou inativo.' using errcode = 'P0002'; end if;
  select * into message_record from public.inbound_messages
  where (provider = p_provider and provider_message_id = p_provider_message_id)
     or (organization_id = address_record.organization_id and idempotency_key = p_idempotency_key)
  limit 1;
  if message_record.id is not null then
    return jsonb_build_object('id', message_record.id, 'organization_id', message_record.organization_id, 'duplicate', true);
  end if;
  if (select count(*) from public.inbound_messages where organization_id = address_record.organization_id and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Limite temporário de mensagens excedido.' using errcode = '54000';
  end if;
  insert into public.inbound_messages (
    organization_id, inbound_address_id, provider, provider_message_id, sender_email,
    subject, received_at, raw_metadata, idempotency_key, status
  ) values (
    address_record.organization_id, address_record.id, left(p_provider,40), left(p_provider_message_id,255),
    left(lower(p_sender_email),320), left(coalesce(nullif(p_subject,''),'(sem assunto)'),300), p_received_at,
    coalesce(p_raw_metadata,'{}'::jsonb), left(p_idempotency_key,255), 'processing'
  ) returning * into message_record;
  return jsonb_build_object('id', message_record.id, 'organization_id', message_record.organization_id, 'duplicate', false);
end;
$$;

create or replace function private.protect_inbound_attachment()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.inbound_messages m where m.id = new.inbound_message_id and m.organization_id = new.organization_id) then
    raise exception 'A mensagem não pertence à organização.' using errcode = '23503';
  end if;
  if new.attachment_id is not null and not exists (select 1 from public.payable_attachments a where a.id = new.attachment_id and a.organization_id = new.organization_id) then
    raise exception 'O anexo não pertence à organização.' using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger inbound_message_attachments_protect before insert or update on public.inbound_message_attachments
for each row execute function private.protect_inbound_attachment();

create or replace function private.sync_inbound_attachment_status()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.inbound_message_attachments
  set processing_status = case new.extraction_status
    when 'completed' then 'completed'::public.inbound_attachment_status
    when 'needs_review' then 'needs_review'::public.inbound_attachment_status
    when 'failed' then 'failed'::public.inbound_attachment_status
    else processing_status end,
    error_message = case when new.extraction_status = 'failed' then new.last_error else null end
  where attachment_id = new.id and processing_status <> 'duplicate';

  update public.inbound_messages m set status = case
    when not exists (select 1 from public.inbound_message_attachments l where l.inbound_message_id=m.id and l.processing_status <> 'completed') then 'completed'::public.inbound_message_status
    when exists (select 1 from public.inbound_message_attachments l where l.inbound_message_id=m.id and l.processing_status in ('needs_review','duplicate')) then 'needs_review'::public.inbound_message_status
    when exists (select 1 from public.inbound_message_attachments l where l.inbound_message_id=m.id and l.processing_status='failed') then 'failed'::public.inbound_message_status
    else m.status end
  where m.id in (select inbound_message_id from public.inbound_message_attachments where attachment_id = new.id)
    and m.status <> 'ignored';
  return new;
end;
$$;
create trigger payable_attachments_sync_inbound after update of extraction_status on public.payable_attachments
for each row execute function private.sync_inbound_attachment_status();

create or replace function private.protect_payable_attachment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare expected_prefix text;
begin
  if tg_op = 'INSERT' then
    expected_prefix := new.organization_id::text || '/' || coalesce(new.account_payable_id::text, 'unassigned') || '/';
    if left(new.storage_path, char_length(expected_prefix)) <> expected_prefix or new.storage_path like '%..%' then
      raise exception 'Caminho de armazenamento inválido.' using errcode = '22023';
    end if;
    if auth.role() <> 'service_role' and new.uploaded_by <> auth.uid() then
      raise exception 'O autor do upload deve ser o usuário autenticado.' using errcode = '42501';
    end if;
  else
    if new.organization_id <> old.organization_id or new.storage_path <> old.storage_path
      or new.original_name <> old.original_name or new.mime_type <> old.mime_type
      or new.size_bytes <> old.size_bytes or new.sha256 <> old.sha256
      or new.uploaded_by <> old.uploaded_by or new.created_at <> old.created_at then
      raise exception 'Metadados originais do anexo são imutáveis.' using errcode = '42501';
    end if;
  end if;
  if new.account_payable_id is not null and not exists (
    select 1 from public.accounts_payable account where account.id = new.account_payable_id and account.organization_id = new.organization_id
  ) then raise exception 'A conta não pertence à organização.' using errcode = '23503'; end if;
  return new;
end;
$$;

create trigger inbound_addresses_audit after insert or update or delete on public.inbound_addresses
for each row execute function private.write_audit_log();
create trigger inbound_messages_audit after update on public.inbound_messages
for each row execute function private.write_audit_log();

revoke all on function public.rotate_inbound_address(uuid) from public, anon;
revoke all on function public.ignore_inbound_message(uuid, uuid) from public, anon;
revoke all on function public.register_inbound_message(text,text,text,text,text,timestamptz,jsonb,text) from public, anon, authenticated;
grant execute on function public.rotate_inbound_address(uuid) to authenticated;
grant execute on function public.ignore_inbound_message(uuid, uuid) to authenticated;
grant execute on function public.register_inbound_message(text,text,text,text,text,timestamptz,jsonb,text) to service_role;
