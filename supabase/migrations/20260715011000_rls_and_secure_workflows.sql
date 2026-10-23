create or replace function private.is_active_member(target_organization_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = target_organization_id
      and member.user_id = target_user_id
      and member.status = 'active'
  );
$$;

create or replace function private.has_organization_role(
  target_organization_id uuid,
  allowed_roles public.organization_role[],
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = target_organization_id
      and member.user_id = target_user_id
      and member.status = 'active'
      and member.role = any (allowed_roles)
  );
$$;

create or replace function private.shares_active_organization(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members current_member
    join public.organization_members other_member
      on other_member.organization_id = current_member.organization_id
    where current_member.user_id = auth.uid()
      and current_member.status = 'active'
      and other_member.user_id = other_user_id
      and other_member.status = 'active'
  );
$$;

grant usage on schema private to authenticated;
revoke all on function private.is_active_member(uuid, uuid) from public, anon;
revoke all on function private.has_organization_role(uuid, public.organization_role[], uuid) from public, anon;
revoke all on function private.shares_active_organization(uuid) from public, anon;
grant execute on function private.is_active_member(uuid, uuid) to authenticated;
grant execute on function private.has_organization_role(uuid, public.organization_role[], uuid) to authenticated;
grant execute on function private.shares_active_organization(uuid) to authenticated;

create policy profiles_select_shared_organization
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.shares_active_organization(id))
);

create policy profiles_insert_self
on public.profiles for insert
to authenticated
with check (id = (select auth.uid()));

create policy profiles_update_self
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy organizations_select_active_member
on public.organizations for select
to authenticated
using ((select private.is_active_member(id)));

create policy organizations_update_admin
on public.organizations for update
to authenticated
using ((select private.has_organization_role(id, array['owner', 'admin']::public.organization_role[])))
with check ((select private.has_organization_role(id, array['owner', 'admin']::public.organization_role[])));

create policy organization_members_select_active_member
on public.organization_members for select
to authenticated
using ((select private.is_active_member(organization_id)));

create policy organization_members_insert_admin
on public.organization_members for insert
to authenticated
with check ((select private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])));

create policy organization_members_update_admin
on public.organization_members for update
to authenticated
using ((select private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])))
with check ((select private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])));

create policy organization_members_delete_admin
on public.organization_members for delete
to authenticated
using ((select private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])));

create policy organization_invitations_select_admin
on public.organization_invitations for select
to authenticated
using ((select private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])));

create policy organization_invitations_insert_admin
on public.organization_invitations for insert
to authenticated
with check (
  invited_by = (select auth.uid())
  and (select private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
);

create policy organization_invitations_update_admin
on public.organization_invitations for update
to authenticated
using ((select private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])))
with check ((select private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])));

create policy organization_invitations_delete_admin
on public.organization_invitations for delete
to authenticated
using ((select private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])));

create policy audit_logs_select_admin
on public.audit_logs for select
to authenticated
using ((select private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])));

create or replace function private.protect_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id
    and coalesce(current_setting('vencii.allow_owner_transfer', true), '') <> 'on' then
    raise exception 'Use transfer_organization_ownership para alterar o proprietário.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger organizations_protect_owner
before update on public.organizations
for each row execute function private.protect_organization_owner();

create or replace function private.protect_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  transfer_allowed boolean := coalesce(current_setting('vencii.allow_owner_transfer', true), '') = 'on';
begin
  if tg_op = 'UPDATE' and (
    new.organization_id is distinct from old.organization_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'organization_id e user_id são imutáveis.' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' and old.role = 'owner' and not transfer_allowed then
    raise exception 'O owner não pode ser removido da organização.' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.role = 'owner'
    and (new.role <> 'owner' or new.status <> 'active')
    and not transfer_allowed then
    raise exception 'O papel ou status do owner só pode mudar em uma transferência.' using errcode = '42501';
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.role = 'owner' and not transfer_allowed then
    if not exists (
      select 1 from public.organizations organization
      where organization.id = new.organization_id and organization.owner_id = new.user_id
    ) then
      raise exception 'Owner só pode ser definido por transferência de propriedade.' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger organization_members_protect_owner
before insert or update or delete on public.organization_members
for each row execute function private.protect_owner_membership();

create or replace function private.protect_invitation_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.accepted_at is distinct from old.accepted_at
    and coalesce(current_setting('vencii.allow_invitation_acceptance', true), '') <> 'on' then
    raise exception 'Convites só podem ser aceitos pelo fluxo seguro.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger organization_invitations_protect_acceptance
before update on public.organization_invitations
for each row execute function private.protect_invitation_acceptance();

create or replace function private.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_data jsonb;
  new_data jsonb;
  target_organization_id uuid;
  target_entity_id uuid;
begin
  old_data := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_data := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;

  if tg_table_name = 'organizations' then
    target_organization_id := case when tg_op = 'DELETE' then old.id else new.id end;
    target_entity_id := target_organization_id;
  elsif tg_table_name = 'organization_members' then
    target_organization_id := case when tg_op = 'DELETE' then old.organization_id else new.organization_id end;
    target_entity_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  else
    target_organization_id := case when tg_op = 'DELETE' then old.organization_id else new.organization_id end;
    target_entity_id := case when tg_op = 'DELETE' then old.id else new.id end;
  end if;

  if tg_table_name = 'organization_invitations' then
    old_data := old_data - 'token_hash';
    new_data := new_data - 'token_hash';
  end if;

  insert into public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data
  ) values (
    target_organization_id,
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    target_entity_id,
    old_data,
    new_data
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger organizations_audit
after insert or update on public.organizations
for each row execute function private.write_audit_log();

create trigger organization_members_audit
after insert or update or delete on public.organization_members
for each row execute function private.write_audit_log();

create trigger organization_invitations_audit
after insert or update or delete on public.organization_invitations
for each row execute function private.write_audit_log();

create or replace function public.complete_onboarding(
  p_full_name text,
  p_phone text,
  p_legal_name text,
  p_trade_name text,
  p_cnpj text,
  p_timezone text default 'America/Sao_Paulo',
  p_currency text default 'BRL'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  created_organization_id uuid;
begin
  if current_user_id is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.organization_members member
    where member.user_id = current_user_id and member.status = 'active'
  ) then
    raise exception 'O usuário já participa de uma organização ativa.' using errcode = '23505';
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Fuso horário inválido.' using errcode = '22023';
  end if;

  insert into public.profiles (id, full_name, phone)
  values (current_user_id, trim(p_full_name), nullif(trim(p_phone), ''))
  on conflict (id) do update
  set full_name = excluded.full_name, phone = excluded.phone;

  insert into public.organizations (
    legal_name,
    trade_name,
    cnpj,
    timezone,
    currency,
    owner_id
  ) values (
    trim(p_legal_name),
    trim(p_trade_name),
    nullif(regexp_replace(p_cnpj, '[^0-9]', '', 'g'), ''),
    p_timezone,
    upper(p_currency),
    current_user_id
  ) returning id into created_organization_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    joined_at
  ) values (
    created_organization_id,
    current_user_id,
    'owner',
    'active',
    now()
  );

  return created_organization_id;
end;
$$;

create or replace function public.transfer_organization_ownership(
  p_organization_id uuid,
  p_new_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if not exists (
    select 1 from public.organizations organization
    where organization.id = p_organization_id and organization.owner_id = current_user_id
  ) then
    raise exception 'Somente o owner atual pode transferir a propriedade.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.organization_members member
    where member.organization_id = p_organization_id
      and member.user_id = p_new_owner_id
      and member.status = 'active'
  ) then
    raise exception 'O novo owner deve ser membro ativo.' using errcode = '23503';
  end if;

  perform set_config('vencii.allow_owner_transfer', 'on', true);

  update public.organization_members
  set role = 'admin'
  where organization_id = p_organization_id and user_id = current_user_id;

  update public.organization_members
  set role = 'owner', status = 'active', joined_at = coalesce(joined_at, now())
  where organization_id = p_organization_id and user_id = p_new_owner_id;

  update public.organizations
  set owner_id = p_new_owner_id
  where id = p_organization_id;
end;
$$;

create or replace function public.accept_organization_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text := lower(auth.jwt() ->> 'email');
  invitation public.organization_invitations%rowtype;
begin
  if current_user_id is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  select * into invitation
  from public.organization_invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'Convite inválido.' using errcode = 'P0001';
  end if;

  if invitation.accepted_at is not null then
    raise exception 'Convite já utilizado.' using errcode = 'P0001';
  end if;

  if invitation.expires_at <= now() then
    raise exception 'Convite expirado.' using errcode = 'P0001';
  end if;

  if current_user_email is null or current_user_email <> invitation.email then
    raise exception 'Este convite pertence a outro e-mail.' using errcode = '42501';
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    invited_by,
    joined_at
  ) values (
    invitation.organization_id,
    current_user_id,
    invitation.role,
    'active',
    invitation.invited_by,
    now()
  )
  on conflict (organization_id, user_id) do update
  set role = excluded.role,
      status = 'active',
      invited_by = excluded.invited_by,
      joined_at = coalesce(public.organization_members.joined_at, now());

  perform set_config('vencii.allow_invitation_acceptance', 'on', true);
  update public.organization_invitations
  set accepted_at = now()
  where id = invitation.id;

  return invitation.organization_id;
end;
$$;

revoke all on function public.complete_onboarding(text, text, text, text, text, text, text) from public, anon;
revoke all on function public.transfer_organization_ownership(uuid, uuid) from public, anon;
revoke all on function public.accept_organization_invitation(text) from public, anon;
grant execute on function public.complete_onboarding(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.transfer_organization_ownership(uuid, uuid) to authenticated;
grant execute on function public.accept_organization_invitation(text) to authenticated;
