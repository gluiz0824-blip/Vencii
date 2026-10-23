alter table public.accounts_payable
  add column paid_date date,
  add column payment_notes text;

alter table public.accounts_payable disable trigger accounts_payable_protect;
update public.accounts_payable
set paid_date = due_date
where status = 'paid';
alter table public.accounts_payable enable trigger accounts_payable_protect;

alter table public.accounts_payable
  add constraint accounts_payable_payment_notes_length
    check (payment_notes is null or char_length(payment_notes) <= 1000),
  add constraint accounts_payable_payment_consistency check (
    (status = 'paid' and paid_date is not null)
    or (status <> 'paid' and paid_date is null and payment_notes is null)
  );

create or replace function private.protect_payable_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.status = 'paid'
    and old.status <> 'paid'
    and coalesce(current_setting('vencii.allow_payable_payment', true), '') <> 'on' then
    raise exception 'Use o fluxo de registro de pagamento.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger accounts_payable_protect_payment
before update on public.accounts_payable
for each row execute function private.protect_payable_payment();

create or replace function public.mark_account_payable_paid(
  p_organization_id uuid,
  p_account_id uuid,
  p_paid_date date,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_status public.payable_status;
  business_today date;
begin
  if current_user_id is null or not private.has_organization_role(
    p_organization_id,
    array['owner', 'admin']::public.organization_role[],
    current_user_id
  ) then
    raise exception 'Somente owner ou admin pode registrar um pagamento.' using errcode = '42501';
  end if;

  if p_paid_date is null then
    raise exception 'Informe a data do pagamento.' using errcode = '22023';
  end if;

  select (now() at time zone organization.timezone)::date
  into business_today
  from public.organizations organization
  where organization.id = p_organization_id;

  if p_paid_date > business_today then
    raise exception 'A data do pagamento não pode estar no futuro.' using errcode = '22023';
  end if;

  if char_length(coalesce(p_notes, '')) > 1000 then
    raise exception 'A observação do pagamento deve ter até 1000 caracteres.' using errcode = '22023';
  end if;

  select status into current_status
  from public.accounts_payable
  where id = p_account_id and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Conta não encontrada.' using errcode = 'P0002';
  end if;

  if current_status = 'paid' then
    return;
  end if;

  if current_status not in ('pending', 'awaiting_approval', 'approved', 'scheduled', 'overdue') then
    raise exception 'Esta conta não pode ser marcada como paga no estado atual.' using errcode = 'P0001';
  end if;

  perform set_config('vencii.allow_payable_payment', 'on', true);
  update public.accounts_payable
  set status = 'paid',
      paid_date = p_paid_date,
      payment_notes = nullif(trim(coalesce(p_notes, '')), ''),
      updated_by = current_user_id
  where id = p_account_id and organization_id = p_organization_id;
end;
$$;

revoke all on function public.mark_account_payable_paid(uuid, uuid, date, text)
from public, anon;
grant execute on function public.mark_account_payable_paid(uuid, uuid, date, text)
to authenticated;
