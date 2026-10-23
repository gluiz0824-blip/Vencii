"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireWorkspace } from "@/dal/workspace";
import {
  approvePayableRequestsBatch,
  createApprovalRule,
  decidePayableApproval,
  requestPayableApproval,
  setApprovalRuleActive,
  setOrganizationSelfApproval,
} from "@/repositories/approval-server.repository";
import {
  approvalDecisionSchema,
  approvalRuleFormSchema,
  batchApprovalSchema,
} from "@/validation/approval";

export interface ApprovalActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

const approverRoles = ["owner", "admin", "approver"] as const;
const adminRoles = ["owner", "admin"] as const;
const writeRoles = ["owner", "admin", "operator"] as const;

function value(formData: FormData, name: string) {
  const item = formData.get(name);
  return typeof item === "string" ? item : "";
}

function hasRole(role: string, allowed: readonly string[]) {
  return allowed.includes(role);
}

function revalidateApprovalViews(accountId?: string) {
  revalidatePath("/app");
  revalidatePath("/app/aprovacoes");
  revalidatePath("/app/calendario");
  revalidatePath("/app/contas-a-pagar");
  if (accountId) revalidatePath(`/app/contas-a-pagar/${accountId}`);
}

export async function requestPayableApprovalAction(accountId: string) {
  const workspace = await requireWorkspace();
  if (!hasRole(workspace.activeOrganization.role, writeRoles))
    throw new Error("Sem permissão para solicitar aprovação.");
  await requestPayableApproval(workspace.activeOrganization.id, accountId);
  revalidateApprovalViews(accountId);
  redirect(`/app/contas-a-pagar/${accountId}?approvalRequested=1`);
}

export async function decidePayableApprovalAction(
  requestId: string,
  decision: "approved" | "rejected",
  _state: ApprovalActionState,
  formData: FormData,
): Promise<ApprovalActionState> {
  const workspace = await requireWorkspace();
  if (!hasRole(workspace.activeOrganization.role, approverRoles))
    return {
      status: "error",
      message: "Seu papel não permite decidir aprovações.",
    };
  const parsed = approvalDecisionSchema.safeParse({
    requestId,
    decision,
    comment: value(formData, "comment"),
  });
  if (!parsed.success)
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: parsed.error.issues[0]?.message,
    };
  try {
    await decidePayableApproval({
      organizationId: workspace.activeOrganization.id,
      requestId: parsed.data.requestId,
      decision: parsed.data.decision,
      comment: parsed.data.comment,
    });
    revalidateApprovalViews();
    return {
      status: "success",
      message:
        decision === "approved"
          ? "Aprovação registrada."
          : "Rejeição registrada.",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível registrar a decisão.",
    };
  }
}

export async function approvePayableRequestsBatchAction(
  _state: ApprovalActionState,
  formData: FormData,
): Promise<ApprovalActionState> {
  const workspace = await requireWorkspace();
  if (!hasRole(workspace.activeOrganization.role, approverRoles))
    return {
      status: "error",
      message: "Seu papel não permite decidir aprovações.",
    };
  const parsed = batchApprovalSchema.safeParse({
    requestIds: formData
      .getAll("requestIds")
      .filter((item): item is string => typeof item === "string"),
    comment: value(formData, "comment"),
  });
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Seleção inválida.",
    };
  try {
    const count = await approvePayableRequestsBatch(
      workspace.activeOrganization.id,
      parsed.data.requestIds,
      parsed.data.comment,
    );
    revalidateApprovalViews();
    return {
      status: "success",
      message: `${count} ${count === 1 ? "aprovação registrada" : "aprovações registradas"}.`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível aprovar em lote.",
    };
  }
}

export async function createApprovalRuleAction(
  _state: ApprovalActionState,
  formData: FormData,
): Promise<ApprovalActionState> {
  const workspace = await requireWorkspace();
  if (!hasRole(workspace.activeOrganization.role, adminRoles))
    return {
      status: "error",
      message: "Somente owner ou admin pode configurar regras.",
    };
  const parsed = approvalRuleFormSchema.safeParse({
    name: value(formData, "name"),
    minAmount: value(formData, "minAmount"),
    maxAmount: value(formData, "maxAmount"),
    categoryId: value(formData, "categoryId"),
    supplierId: value(formData, "supplierId"),
    requiredApprovals: value(formData, "requiredApprovals"),
    priority: value(formData, "priority"),
  });
  if (!parsed.success)
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: parsed.error.issues[0]?.message,
    };
  try {
    await createApprovalRule(workspace.activeOrganization.id, parsed.data);
    revalidatePath("/app/configuracoes/aprovacoes");
    return { status: "success", message: "Regra criada com sucesso." };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível criar a regra.",
    };
  }
}

export async function toggleApprovalRuleAction(
  ruleId: string,
  formData: FormData,
) {
  const workspace = await requireWorkspace();
  if (!hasRole(workspace.activeOrganization.role, adminRoles))
    throw new Error("Sem permissão para alterar regras.");
  await setApprovalRuleActive(
    workspace.activeOrganization.id,
    ruleId,
    value(formData, "active") === "true",
  );
  revalidatePath("/app/configuracoes/aprovacoes");
}

export async function setSelfApprovalAction(formData: FormData) {
  const workspace = await requireWorkspace();
  if (!hasRole(workspace.activeOrganization.role, adminRoles))
    throw new Error("Sem permissão para alterar esta configuração.");
  await setOrganizationSelfApproval(
    workspace.activeOrganization.id,
    value(formData, "allow") === "true",
  );
  revalidatePath("/app/configuracoes/aprovacoes");
}
