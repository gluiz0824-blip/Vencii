import "server-only";

import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import type {
  ApprovalDecision,
  ApprovalRequestStatus,
  Database,
  NotificationType,
  PayableDocumentType,
} from "@/types/database";

type ApprovalRuleRow = Database["public"]["Tables"]["approval_rules"]["Row"];

export interface ApprovalInboxItem {
  requestId: string;
  accountId: string;
  description: string;
  supplierName: string | null;
  amountCents: number;
  dueDate: string;
  documentType: PayableDocumentType;
  documentNumber: string | null;
  barcode: string | null;
  requiredApprovals: number;
  approvalCount: number;
  requestedAt: string;
  createdBy: string;
  canDecide: boolean;
}

export interface ApprovalRuleListItem extends ApprovalRuleRow {
  categoryName: string | null;
  supplierName: string | null;
}

export interface ApprovalHistoryItem {
  requestId: string;
  status: ApprovalRequestStatus;
  requiredApprovals: number;
  requestedAt: string;
  completedAt: string | null;
  requestedByName: string;
  decisions: {
    id: string;
    approverName: string;
    decision: ApprovalDecision;
    comment: string | null;
    decidedAt: string;
  }[];
}

export interface InternalNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function listApprovalInbox(input: {
  organizationId: string;
  businessDate: string;
  urgency?: string;
  dueFrom?: string;
  dueTo?: string;
  minAmountCents?: number;
  maxAmountCents?: number;
  supplierId?: string;
}): Promise<ApprovalInboxItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_approval_inbox", {
    p_organization_id: input.organizationId,
    p_business_date: input.businessDate,
    p_urgency: input.urgency || null,
    p_due_from: input.dueFrom || null,
    p_due_to: input.dueTo || null,
    p_min_amount_cents: input.minAmountCents ?? null,
    p_max_amount_cents: input.maxAmountCents ?? null,
    p_supplier_id: input.supplierId || null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((item) => ({
    requestId: item.request_id,
    accountId: item.account_id,
    description: item.description,
    supplierName: item.supplier_name,
    amountCents: item.amount_cents,
    dueDate: item.due_date,
    documentType: item.document_type,
    documentNumber: item.document_number,
    barcode: item.barcode,
    requiredApprovals: item.required_approvals,
    approvalCount: item.approval_count,
    requestedAt: item.requested_at,
    createdBy: item.created_by,
    canDecide: item.can_decide,
  }));
}

export async function requestPayableApproval(
  organizationId: string,
  accountId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("request_payable_approval", {
    p_organization_id: organizationId,
    p_account_id: accountId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function decidePayableApproval(input: {
  organizationId: string;
  requestId: string;
  decision: ApprovalDecision;
  comment: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("decide_payable_approval", {
    p_organization_id: input.organizationId,
    p_request_id: input.requestId,
    p_decision: input.decision,
    p_comment: input.comment || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function approvePayableRequestsBatch(
  organizationId: string,
  requestIds: string[],
  comment: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("approve_payable_requests_batch", {
    p_organization_id: organizationId,
    p_request_ids: requestIds,
    p_comment: comment || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function createDueApprovalNotifications(
  organizationId: string,
  businessDate: string,
) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_due_approval_notifications", {
    p_organization_id: organizationId,
    p_business_date: businessDate,
    p_days_ahead: 2,
  });
  if (error) throw new Error(error.message);
}

export async function listApprovalRules(
  organizationId: string,
): Promise<ApprovalRuleListItem[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: rules, error }, { data: categories }, { data: suppliers }] =
    await Promise.all([
      supabase
        .from("approval_rules")
        .select("*")
        .eq("organization_id", organizationId)
        .order("priority", { ascending: false })
        .order("created_at"),
      supabase
        .from("expense_categories")
        .select("id, name")
        .eq("organization_id", organizationId),
      supabase
        .from("suppliers")
        .select("id, name")
        .eq("organization_id", organizationId),
    ]);
  if (error)
    throw new Error("Não foi possível carregar as regras de aprovação.");
  const categoryNames = new Map(
    (categories ?? []).map((item) => [item.id, item.name]),
  );
  const supplierNames = new Map(
    (suppliers ?? []).map((item) => [item.id, item.name]),
  );
  return (rules ?? []).map((rule) => ({
    ...rule,
    categoryName: rule.category_id
      ? (categoryNames.get(rule.category_id) ?? null)
      : null,
    supplierName: rule.supplier_id
      ? (supplierNames.get(rule.supplier_id) ?? null)
      : null,
  }));
}

export async function createApprovalRule(
  organizationId: string,
  input: {
    name: string;
    minAmountCents: number | null;
    maxAmountCents: number | null;
    categoryId: string | null;
    supplierId: string | null;
    requiredApprovals: number;
    priority: number;
  },
) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("approval_rules").insert({
    organization_id: organizationId,
    name: input.name,
    min_amount_cents: input.minAmountCents,
    max_amount_cents: input.maxAmountCents,
    category_id: input.categoryId,
    supplier_id: input.supplierId,
    required_approvals: input.requiredApprovals,
    priority: input.priority,
  });
  if (error) throw new Error(error.message);
}

export async function setApprovalRuleActive(
  organizationId: string,
  ruleId: string,
  active: boolean,
) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("approval_rules")
    .update({ active })
    .eq("organization_id", organizationId)
    .eq("id", ruleId);
  if (error) throw new Error(error.message);
}

export async function setOrganizationSelfApproval(
  organizationId: string,
  allow: boolean,
) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({ allow_self_approval: allow })
    .eq("id", organizationId);
  if (error) throw new Error(error.message);
}

export async function listAccountApprovalHistory(
  organizationId: string,
  accountId: string,
): Promise<ApprovalHistoryItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data: requests, error } = await supabase
    .from("payable_approval_requests")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("account_payable_id", accountId)
    .order("requested_at", { ascending: false });
  if (error)
    throw new Error("Não foi possível carregar o histórico de aprovação.");
  const requestIds = (requests ?? []).map((item) => item.id);
  const { data: approvals } = requestIds.length
    ? await supabase
        .from("payable_approvals")
        .select("*")
        .in("request_id", requestIds)
        .order("decided_at")
    : { data: [] };
  const userIds = [
    ...new Set([
      ...(requests ?? []).map((item) => item.requested_by),
      ...(approvals ?? []).map((item) => item.approver_id),
    ]),
  ];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] };
  const names = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      profile.full_name || "Usuário",
    ]),
  );
  return (requests ?? []).map((request) => ({
    requestId: request.id,
    status: request.status,
    requiredApprovals: request.required_approvals,
    requestedAt: request.requested_at,
    completedAt: request.completed_at,
    requestedByName: names.get(request.requested_by) ?? "Usuário",
    decisions: (approvals ?? [])
      .filter((item) => item.request_id === request.id)
      .map((item) => ({
        id: item.id,
        approverName: names.get(item.approver_id) ?? "Usuário",
        decision: item.decision,
        comment: item.comment,
        decidedAt: item.decided_at,
      })),
  }));
}

export async function listNotifications(
  organizationId: string,
): Promise<InternalNotification[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, entity_id, read_at, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error("Não foi possível carregar as notificações.");
  return (data ?? []).map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    entityId: item.entity_id,
    readAt: item.read_at,
    createdAt: item.created_at,
  }));
}
