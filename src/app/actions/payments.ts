"use server";

import { revalidatePath } from "next/cache";

import { requireWorkspace } from "@/dal/workspace";
import {
  registerAccountPayment,
  reverseAccountPayment,
  updatePaymentSettings,
} from "@/repositories/payment-server.repository";
import {
  paymentRegistrationSchema,
  paymentReversalSchema,
  paymentSettingsSchema,
} from "@/validation/payment";

export interface PaymentActionResult {
  status: "success" | "error";
  message: string;
  paymentId?: string;
}

function isAdmin(role: string) {
  return role === "owner" || role === "admin";
}

function refreshPaymentViews(accountId?: string) {
  revalidatePath("/app");
  revalidatePath("/app/calendario");
  revalidatePath("/app/contas-a-pagar");
  if (accountId) revalidatePath(`/app/contas-a-pagar/${accountId}`);
}

export async function registerPaymentAction(
  input: unknown,
): Promise<PaymentActionResult> {
  const workspace = await requireWorkspace();
  if (!isAdmin(workspace.activeOrganization.role))
    return {
      status: "error",
      message: "Somente owner ou admin pode registrar pagamentos.",
    };
  const parsed = paymentRegistrationSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  try {
    const paymentId = await registerAccountPayment({
      organizationId: workspace.activeOrganization.id,
      accountId: parsed.data.accountId,
      paidAmountCents: parsed.data.amount,
      paidAt: parsed.data.paidAt,
      paymentMethod: parsed.data.paymentMethod,
      bankReference: parsed.data.bankReference,
      notes: parsed.data.notes,
      idempotencyKey: parsed.data.idempotencyKey,
      confirmOverpayment: parsed.data.confirmOverpayment,
    });
    refreshPaymentViews(parsed.data.accountId);
    return {
      status: "success",
      message: "Pagamento registrado com sucesso.",
      paymentId,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível registrar o pagamento.",
    };
  }
}

export async function reversePaymentAction(
  accountId: string,
  input: unknown,
): Promise<PaymentActionResult> {
  const workspace = await requireWorkspace();
  if (!isAdmin(workspace.activeOrganization.role))
    return {
      status: "error",
      message: "Somente owner ou admin pode estornar pagamentos.",
    };
  const parsed = paymentReversalSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Confirmação inválida.",
    };
  try {
    await reverseAccountPayment(
      workspace.activeOrganization.id,
      parsed.data.paymentId,
      parsed.data.reason,
    );
    refreshPaymentViews(accountId);
    return { status: "success", message: "Pagamento estornado." };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível estornar o pagamento.",
    };
  }
}

export async function updatePaymentSettingsAction(
  _state: PaymentActionResult,
  formData: FormData,
): Promise<PaymentActionResult> {
  const workspace = await requireWorkspace();
  if (!isAdmin(workspace.activeOrganization.role))
    return {
      status: "error",
      message: "Somente owner ou admin pode alterar estas preferências.",
    };
  const parsed = paymentSettingsSchema.safeParse({
    allowPartialPayments: formData.get("allowPartialPayments") === "on",
    allowOverpayments: formData.get("allowOverpayments") === "on",
    overpaymentTolerance:
      typeof formData.get("overpaymentTolerance") === "string"
        ? formData.get("overpaymentTolerance")
        : "0,00",
  });
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Preferências inválidas.",
    };
  try {
    await updatePaymentSettings({
      organizationId: workspace.activeOrganization.id,
      allowPartialPayments: parsed.data.allowPartialPayments,
      allowOverpayments: parsed.data.allowOverpayments,
      overpaymentToleranceCents: parsed.data.overpaymentTolerance,
    });
    revalidatePath("/app/configuracoes/pagamentos");
    return { status: "success", message: "Preferências salvas." };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível salvar as preferências.",
    };
  }
}
