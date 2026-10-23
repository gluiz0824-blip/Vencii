create type public.payable_document_type as enum (
  'boleto',
  'pix',
  'transferencia',
  'cartao',
  'imposto',
  'outro'
);

create type public.payable_status as enum (
  'draft',
  'pending',
  'awaiting_approval',
  'approved',
  'scheduled',
  'paid',
  'overdue',
  'rejected',
  'canceled'
);

create type public.payable_source as enum ('manual', 'upload', 'email', 'import');

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  tax_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_name_length check (char_length(trim(name)) between 2 and 180),
  constraint suppliers_tax_id_format check (tax_id is null or tax_id ~ '^[0-9]{11,14}$')
);

create index suppliers_organization_name_idx
  on public.suppliers (organization_id, name);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_categories_name_length check (char_length(trim(name)) between 2 and 100),
  constraint expense_categories_name_unique unique (organization_id, name)
);

create table public.accounts_payable (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  expense_category_id uuid references public.expense_categories (id) on delete set null,
  description text not null,
  document_type public.payable_document_type not null,
  document_number text,
  barcode text,
  pix_code text,
  document_hash text,
  amount_cents bigint not null,
  issue_date date,
  due_date date not null,
  competence_date date,
  status public.payable_status not null default 'pending',
  notes text,
  cancellation_reason text,
  recurrence_group_id uuid,
  installment_number integer,
  installment_total integer,
  source public.payable_source not null default 'manual',
  idempotency_key text not null,
  occurrence_index integer not null default 1,
  created_by uuid not null references auth.users (id) on delete restrict,
  updated_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_payable_description_length check (char_length(trim(description)) between 2 and 240),
  constraint accounts_payable_amount_positive check (amount_cents > 0 and amount_cents <= 9000000000000000),
  constraint accounts_payable_date_order check (issue_date is null or issue_date <= due_date),
  constraint accounts_payable_document_number_length check (document_number is null or char_length(document_number) <= 120),
  constraint accounts_payable_barcode_length check (barcode is null or char_length(barcode) between 8 and 160),
  constraint accounts_payable_notes_length check (notes is null or char_length(notes) <= 4000),
  constraint accounts_payable_document_hash_format check (document_hash is null or document_hash ~ '^[0-9a-f]{64}$'),
  constraint accounts_payable_idempotency_key_length check (char_length(idempotency_key) between 16 and 120),
  constraint accounts_payable_occurrence_index_positive check (occurrence_index > 0),
  constraint accounts_payable_installment_consistency check (
    (installment_number is null and installment_total is null)
    or (
      installment_number between 1 and installment_total
      and installment_total between 2 and 360
      and recurrence_group_id is not null
    )
  ),
  constraint accounts_payable_cancellation_consistency check (
    (status = 'canceled' and cancellation_reason is not null and char_length(trim(cancellation_reason)) between 3 and 500)
    or (status <> 'canceled' and cancellation_reason is null)
  ),
  constraint accounts_payable_idempotency_unique unique (
    organization_id,
    idempotency_key,
    occurrence_index
  )
);

create index accounts_payable_organization_due_date_idx
  on public.accounts_payable (organization_id, due_date, id);
create index accounts_payable_organization_status_idx
  on public.accounts_payable (organization_id, status, due_date);
create index accounts_payable_supplier_idx
  on public.accounts_payable (organization_id, supplier_id, due_date);
create index accounts_payable_barcode_idx
  on public.accounts_payable (organization_id, barcode)
  where barcode is not null;
create index accounts_payable_recurrence_group_idx
  on public.accounts_payable (organization_id, recurrence_group_id, occurrence_index)
  where recurrence_group_id is not null;
create index accounts_payable_document_hash_idx
  on public.accounts_payable (organization_id, document_hash)
  where document_hash is not null;

alter table public.suppliers enable row level security;
alter table public.expense_categories enable row level security;
alter table public.accounts_payable enable row level security;

create policy suppliers_select_active_member
on public.suppliers for select to authenticated
using ((select private.is_active_member(organization_id)));

create policy suppliers_write_operator
on public.suppliers for all to authenticated
using ((select private.has_organization_role(organization_id, array['owner', 'admin', 'operator']::public.organization_role[])))
with check ((select private.has_organization_role(organization_id, array['owner', 'admin', 'operator']::public.organization_role[])));

create policy expense_categories_select_active_member
on public.expense_categories for select to authenticated
using ((select private.is_active_member(organization_id)));

create policy expense_categories_write_admin
on public.expense_categories for all to authenticated
using ((select private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])))
with check ((select private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])));

create policy accounts_payable_select_active_member
on public.accounts_payable for select to authenticated
using ((select private.is_active_member(organization_id)));

create policy accounts_payable_insert_operator
on public.accounts_payable for insert to authenticated
with check (
  created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and (select private.has_organization_role(organization_id, array['owner', 'admin', 'operator']::public.organization_role[]))
);

create policy accounts_payable_update_operator
on public.accounts_payable for update to authenticated
using ((select private.has_organization_role(organization_id, array['owner', 'admin', 'operator']::public.organization_role[])))
with check (
  updated_by = (select auth.uid())
  and (select private.has_organization_role(organization_id, array['owner', 'admin', 'operator']::public.organization_role[]))
);

grant select, insert, update, delete on public.suppliers to authenticated;
grant select, insert, update, delete on public.expense_categories to authenticated;
grant select, insert, update on public.accounts_payable to authenticated;

create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute function private.set_updated_at();

create trigger expense_categories_set_updated_at
before update on public.expense_categories
for each row execute function private.set_updated_at();

create trigger accounts_payable_set_updated_at
before update on public.accounts_payable
for each row execute function private.set_updated_at();

create or replace function private.protect_account_payable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by <> auth.uid() or new.updated_by <> auth.uid() then
      raise exception 'O autor da conta deve ser o usuário autenticado.' using errcode = '42501';
    end if;

    if new.status in ('approved', 'scheduled', 'paid', 'rejected')
      and not private.has_organization_role(
        new.organization_id,
        array['owner', 'admin']::public.organization_role[],
        auth.uid()
      ) then
      raise exception 'O papel operator não pode definir estados de decisão ou pagamento.' using errcode = '42501';
    end if;
  else
    if new.organization_id <> old.organization_id
      or new.created_by <> old.created_by
      or new.idempotency_key <> old.idempotency_key
      or new.occurrence_index <> old.occurrence_index then
      raise exception 'Organização, autoria e chave idempotente são imutáveis.' using errcode = '42501';
    end if;

    if old.status in ('paid', 'canceled', 'rejected') and (
      to_jsonb(new) - array['notes', 'updated_by', 'updated_at']
      <> to_jsonb(old) - array['notes', 'updated_by', 'updated_at']
    ) then
      raise exception 'Conta finalizada permite alterar somente observações.' using errcode = '42501';
    end if;

    if new.status = 'canceled' and old.status <> 'canceled'
      and coalesce(current_setting('vencii.allow_payable_cancellation', true), '') <> 'on' then
      raise exception 'Use o fluxo de cancelamento com motivo.' using errcode = '42501';
    end if;

    if new.status is distinct from old.status
      and new.status in ('approved', 'scheduled', 'paid', 'rejected')
      and not private.has_organization_role(
        new.organization_id,
        array['owner', 'admin']::public.organization_role[],
        auth.uid()
      ) then
      raise exception 'O papel operator não pode definir estados de decisão ou pagamento.' using errcode = '42501';
    end if;

    if new.updated_by <> auth.uid() then
      raise exception 'O editor deve ser o usuário autenticado.' using errcode = '42501';
    end if;
  end if;

  if new.supplier_id is not null and not exists (
    select 1 from public.suppliers supplier
    where supplier.id = new.supplier_id and supplier.organization_id = new.organization_id
  ) then
    raise exception 'Fornecedor não pertence à organização.' using errcode = '23503';
  end if;

  if new.expense_category_id is not null and not exists (
    select 1 from public.expense_categories category
    where category.id = new.expense_category_id and category.organization_id = new.organization_id
  ) then
    raise exception 'Categoria não pertence à organização.' using errcode = '23503';
  end if;

  return new;
end;
$$;

create trigger accounts_payable_protect
before insert or update on public.accounts_payable
for each row execute function private.protect_account_payable();

create trigger accounts_payable_audit
after insert or update on public.accounts_payable
for each row execute function private.write_audit_log();

create or replace function public.cancel_account_payable(
  p_organization_id uuid,
  p_account_id uuid,
  p_reason text
)
returns void
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
    raise exception 'Sem permissão para cancelar esta conta.' using errcode = '42501';
  end if;

  if char_length(trim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'Informe um motivo de cancelamento entre 3 e 500 caracteres.' using errcode = '22023';
  end if;

  select status into current_status
  from public.accounts_payable
  where id = p_account_id and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Conta não encontrada.' using errcode = 'P0002';
  end if;

  if current_status in ('paid', 'canceled', 'rejected') then
    raise exception 'Esta conta não pode ser cancelada no estado atual.' using errcode = 'P0001';
  end if;

  perform set_config('vencii.allow_payable_cancellation', 'on', true);
  update public.accounts_payable
  set status = 'canceled', cancellation_reason = trim(p_reason), updated_by = current_user_id
  where id = p_account_id and organization_id = p_organization_id;
end;
$$;

create or replace function public.mark_overdue_accounts(
  p_organization_id uuid,
  p_business_date date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if auth.uid() is null or not private.is_active_member(p_organization_id, auth.uid()) then
    raise exception 'Organização não autorizada.' using errcode = '42501';
  end if;

  update public.accounts_payable
  set status = 'overdue', updated_by = auth.uid()
  where organization_id = p_organization_id
    and due_date < p_business_date
    and status in ('pending', 'awaiting_approval', 'approved', 'scheduled');

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.cancel_account_payable(uuid, uuid, text) from public, anon;
revoke all on function public.mark_overdue_accounts(uuid, date) from public, anon;
grant execute on function public.cancel_account_payable(uuid, uuid, text) to authenticated;
grant execute on function public.mark_overdue_accounts(uuid, date) to authenticated;
