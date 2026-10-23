create or replace function public.request_payable_approval(
  p_organization_id uuid,
  p_account_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_status public.payable_status;
begin
  if current_user_id is null or not private.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'operator']::public.organization_role[],
    current_user_id
  ) then
    raise exception 'Sem permissão para enviar esta conta para aprovação.' using errcode = '42501';
  end if;

  select status into current_status
  from public.accounts_payable
  where id = p_account_id and organization_id = p_organization_id;
  if not found then
    raise exception 'Conta não encontrada.' using errcode = 'P0002';
  end if;
  if current_status not in ('draft', 'pending', 'overdue', 'awaiting_approval') then
    raise exception 'Esta conta não pode ser enviada para aprovação no estado atual.' using errcode = 'P0001';
  end if;

  return private.create_payable_approval_request(
    p_organization_id, p_account_id, current_user_id, false
  );
end;
$$;

create or replace function private.protect_pending_approval_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'paid' and old.status <> 'paid' and exists (
    select 1
    from public.payable_approval_requests request
    where request.account_payable_id = new.id and request.status = 'pending'
  ) then
    raise exception 'A conta precisa ser aprovada antes do registro de pagamento.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger accounts_payable_protect_pending_approval_payment
before update on public.accounts_payable
for each row execute function private.protect_pending_approval_payment();
