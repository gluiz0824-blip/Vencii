import "server-only";

import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import type {
  Database,
  Json,
  PayableSource,
  PayableStatus,
} from "@/types/database";

type PayableRow = Database["public"]["Tables"]["accounts_payable"]["Row"];
type PayableInsert = Database["public"]["Tables"]["accounts_payable"]["Insert"];
type PayableUpdate = Database["public"]["Tables"]["accounts_payable"]["Update"];

export interface PayableListItem extends PayableRow {
  supplierName: string | null;
  categoryName: string | null;
}

export interface PayableFilters {
  query?: string;
  dueFrom?: string;
  dueTo?: string;
  statuses?: PayableStatus[];
  supplierId?: string;
  categoryId?: string;
  source?: PayableSource;
  minAmountCents?: number;
  maxAmountCents?: number;
  sort?: "due_date" | "amount_cents" | "description" | "status" | "created_at";
  direction?: "asc" | "desc";
  page: number;
  pageSize: number;
}

export interface PayableListResult {
  items: PayableListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LookupOption {
  id: string;
  name: string;
}

export interface PayableAuditEntry {
  id: number;
  action: string;
  actorUserId: string | null;
  beforeData: Json | null;
  afterData: Json | null;
  createdAt: string;
}

export interface PayableDashboardSummary {
  outstandingCents: number;
  dueNextSevenDaysCents: number;
  awaitingApprovalCount: number;
  totalCount: number;
}

async function loadLookupMaps(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: suppliers }, { data: categories }] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, name")
      .eq("organization_id", organizationId)
      .order("name"),
    supabase
      .from("expense_categories")
      .select("id, name")
      .eq("organization_id", organizationId)
      .order("name"),
  ]);

  return {
    suppliers: suppliers ?? [],
    categories: categories ?? [],
    supplierNames: new Map(
      (suppliers ?? []).map((item) => [item.id, item.name]),
    ),
    categoryNames: new Map(
      (categories ?? []).map((item) => [item.id, item.name]),
    ),
  };
}

export async function listPayableLookups(
  organizationId: string,
): Promise<{ suppliers: LookupOption[]; categories: LookupOption[] }> {
  const lookup = await loadLookupMaps(organizationId);
  return { suppliers: lookup.suppliers, categories: lookup.categories };
}

export async function getPayableDashboardSummary(
  organizationId: string,
  today: string,
  sevenDaysFromNow: string,
): Promise<PayableDashboardSummary> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("accounts_payable")
    .select("amount_cents, due_date, status")
    .eq("organization_id", organizationId);
  if (error) throw new Error("Não foi possível carregar o resumo financeiro.");
  const items = data ?? [];
  const open = items.filter(
    ({ status }) =>
      !(["paid", "canceled", "rejected"] as PayableStatus[]).includes(status),
  );
  return {
    outstandingCents: open.reduce((sum, item) => sum + item.amount_cents, 0),
    dueNextSevenDaysCents: open
      .filter(
        ({ due_date }) => due_date >= today && due_date <= sevenDaysFromNow,
      )
      .reduce((sum, item) => sum + item.amount_cents, 0),
    awaitingApprovalCount: items.filter(
      ({ status }) => status === "awaiting_approval",
    ).length,
    totalCount: items.length,
  };
}

export async function markOrganizationAccountsOverdue(
  organizationId: string,
  businessDate: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("mark_overdue_accounts", {
    p_organization_id: organizationId,
    p_business_date: businessDate,
  });
  if (error) throw new Error("Não foi possível atualizar as contas vencidas.");
}

export async function listAccountsPayable(
  organizationId: string,
  filters: PayableFilters,
): Promise<PayableListResult> {
  const supabase = await createSupabaseServerClient();
  const lookup = await loadLookupMaps(organizationId);
  let query = supabase
    .from("accounts_payable")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId);

  const search = filters.query?.trim().replace(/[^\p{L}\p{N} ._/-]/gu, "");
  if (search) {
    const supplierIds = lookup.suppliers
      .filter(({ name }) =>
        name
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR")),
      )
      .map(({ id }) => id);
    const clauses = [
      `description.ilike.%${search}%`,
      `document_number.ilike.%${search}%`,
      `barcode.ilike.%${search}%`,
    ];
    if (supplierIds.length > 0)
      clauses.push(`supplier_id.in.(${supplierIds.join(",")})`);
    query = query.or(clauses.join(","));
  }
  if (filters.dueFrom) query = query.gte("due_date", filters.dueFrom);
  if (filters.dueTo) query = query.lte("due_date", filters.dueTo);
  if (filters.statuses?.length) query = query.in("status", filters.statuses);
  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
  if (filters.categoryId)
    query = query.eq("expense_category_id", filters.categoryId);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.minAmountCents !== undefined)
    query = query.gte("amount_cents", filters.minAmountCents);
  if (filters.maxAmountCents !== undefined)
    query = query.lte("amount_cents", filters.maxAmountCents);

  const sort = filters.sort ?? "due_date";
  const from = (filters.page - 1) * filters.pageSize;
  const { data, count, error } = await query
    .order(sort, { ascending: filters.direction === "asc" })
    .order("id", { ascending: true })
    .range(from, from + filters.pageSize - 1);

  if (error) throw new Error("Não foi possível carregar as contas a pagar.");
  return {
    items: (data ?? []).map((item) => ({
      ...item,
      supplierName: item.supplier_id
        ? (lookup.supplierNames.get(item.supplier_id) ?? null)
        : null,
      categoryName: item.expense_category_id
        ? (lookup.categoryNames.get(item.expense_category_id) ?? null)
        : null,
    })),
    total: count ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function findAccountPayable(
  organizationId: string,
  accountId: string,
): Promise<PayableListItem | null> {
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, lookup] = await Promise.all([
    supabase
      .from("accounts_payable")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", accountId)
      .maybeSingle(),
    loadLookupMaps(organizationId),
  ]);
  if (error) throw new Error("Não foi possível carregar a conta.");
  if (!data) return null;
  return {
    ...data,
    supplierName: data.supplier_id
      ? (lookup.supplierNames.get(data.supplier_id) ?? null)
      : null,
    categoryName: data.expense_category_id
      ? (lookup.categoryNames.get(data.expense_category_id) ?? null)
      : null,
  };
}

export async function listRelatedAccounts(
  organizationId: string,
  recurrenceGroupId: string | null,
): Promise<PayableListItem[]> {
  if (!recurrenceGroupId) return [];
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, lookup] = await Promise.all([
    supabase
      .from("accounts_payable")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("recurrence_group_id", recurrenceGroupId)
      .order("occurrence_index"),
    loadLookupMaps(organizationId),
  ]);
  if (error)
    throw new Error("Não foi possível carregar as contas relacionadas.");
  return (data ?? []).map((item) => ({
    ...item,
    supplierName: item.supplier_id
      ? (lookup.supplierNames.get(item.supplier_id) ?? null)
      : null,
    categoryName: item.expense_category_id
      ? (lookup.categoryNames.get(item.expense_category_id) ?? null)
      : null,
  }));
}

export async function listAccountAudit(
  organizationId: string,
  accountId: string,
): Promise<PayableAuditEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, actor_user_id, before_data, after_data, created_at")
    .eq("organization_id", organizationId)
    .eq("entity_type", "accounts_payable")
    .eq("entity_id", accountId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((entry) => ({
    id: entry.id,
    action: entry.action,
    actorUserId: entry.actor_user_id,
    beforeData: entry.before_data,
    afterData: entry.after_data,
    createdAt: entry.created_at,
  }));
}

export async function findProbableDuplicates(
  organizationId: string,
  input: {
    supplierId: string | null;
    amountCents: number;
    dueDates: string[];
    barcode: string | null;
    documentHash: string | null;
    excludedId?: string;
  },
): Promise<PayableRow[]> {
  const supabase = await createSupabaseServerClient();
  const clauses: string[] = [];
  if (input.barcode) clauses.push(`barcode.eq.${input.barcode}`);
  if (input.documentHash)
    clauses.push(`document_hash.eq.${input.documentHash}`);
  if (input.supplierId) {
    clauses.push(
      `and(supplier_id.eq.${input.supplierId},amount_cents.eq.${input.amountCents},due_date.in.(${input.dueDates.join(",")}))`,
    );
  }
  if (clauses.length === 0) return [];

  let query = supabase
    .from("accounts_payable")
    .select("*")
    .eq("organization_id", organizationId)
    .neq("status", "canceled")
    .or(clauses.join(","))
    .limit(10);
  if (input.excludedId) query = query.neq("id", input.excludedId);
  const { data, error } = await query;
  if (error)
    throw new Error("Não foi possível verificar possíveis duplicidades.");
  return data ?? [];
}

export async function insertAccountsPayable(
  organizationId: string,
  idempotencyKey: string,
  records: PayableInsert[],
): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("accounts_payable").upsert(records, {
    onConflict: "organization_id,idempotency_key,occurrence_index",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(error.message);

  const { data, error: readError } = await supabase
    .from("accounts_payable")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("idempotency_key", idempotencyKey)
    .order("occurrence_index");
  if (readError || !data?.length)
    throw new Error("Não foi possível confirmar o cadastro.");
  return data.map(({ id }) => id);
}

export async function findAccountsByIdempotencyKey(
  organizationId: string,
  idempotencyKey: string,
): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("accounts_payable")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("idempotency_key", idempotencyKey)
    .order("occurrence_index");
  if (error) throw new Error("Não foi possível verificar a chave idempotente.");
  return (data ?? []).map(({ id }) => id);
}

export async function updateAccountPayable(
  organizationId: string,
  accountId: string,
  values: PayableUpdate,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("accounts_payable")
    .update(values)
    .eq("organization_id", organizationId)
    .eq("id", accountId);
  if (error) throw new Error(error.message);
}

export async function cancelAccountPayable(
  organizationId: string,
  accountId: string,
  reason: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_account_payable", {
    p_organization_id: organizationId,
    p_account_id: accountId,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
}

export async function markAccountPayablePaid(
  organizationId: string,
  accountId: string,
  paidDate: string,
  notes: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("mark_account_payable_paid", {
    p_organization_id: organizationId,
    p_account_id: accountId,
    p_paid_date: paidDate,
    p_notes: notes.trim() || null,
  });
  if (error) throw new Error(error.message);
}
