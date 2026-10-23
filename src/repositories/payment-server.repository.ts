import "server-only";

import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import type { Database, PaymentMethod } from "@/types/database";

export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
export type PaymentReceipt = Pick<
  Database["public"]["Tables"]["payable_attachments"]["Row"],
  "id" | "payment_id" | "original_name" | "mime_type" | "size_bytes"
>;

export interface AccountPaymentSummary {
  payments: PaymentRow[];
  receipts: PaymentReceipt[];
  activePaidCents: number;
}

export async function listAccountPayments(
  organizationId: string,
  accountId: string,
): Promise<AccountPaymentSummary> {
  const supabase = await createSupabaseServerClient();
  const [{ data: payments, error }, { data: receipts, error: receiptError }] =
    await Promise.all([
      supabase
        .from("payments")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("account_payable_id", accountId)
        .order("paid_at", { ascending: false }),
      supabase
        .from("payable_attachments")
        .select("id, payment_id, original_name, mime_type, size_bytes")
        .eq("organization_id", organizationId)
        .eq("account_payable_id", accountId)
        .eq("attachment_type", "receipt")
        .not("payment_id", "is", null)
        .order("created_at", { ascending: false }),
    ]);
  if (error) throw new Error("Não foi possível carregar os pagamentos.");
  if (receiptError)
    throw new Error("Não foi possível carregar os comprovantes.");
  const rows = payments ?? [];
  return {
    payments: rows,
    receipts: receipts ?? [],
    activePaidCents: rows
      .filter((payment) => !payment.reversed_at)
      .reduce((total, payment) => total + payment.paid_amount_cents, 0),
  };
}

export async function registerAccountPayment(input: {
  organizationId: string;
  accountId: string;
  paidAmountCents: number;
  paidAt: string;
  paymentMethod: PaymentMethod;
  bankReference: string;
  notes: string;
  idempotencyKey: string;
  confirmOverpayment: boolean;
}): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("register_account_payment", {
    p_organization_id: input.organizationId,
    p_account_id: input.accountId,
    p_paid_amount_cents: input.paidAmountCents,
    p_paid_at: input.paidAt,
    p_payment_method: input.paymentMethod,
    p_bank_reference: input.bankReference || null,
    p_notes: input.notes || null,
    p_idempotency_key: input.idempotencyKey,
    p_confirm_overpayment: input.confirmOverpayment,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function reverseAccountPayment(
  organizationId: string,
  paymentId: string,
  reason: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reverse_account_payment", {
    p_organization_id: organizationId,
    p_payment_id: paymentId,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
}

export async function updatePaymentSettings(input: {
  organizationId: string;
  allowPartialPayments: boolean;
  allowOverpayments: boolean;
  overpaymentToleranceCents: number;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      allow_partial_payments: input.allowPartialPayments,
      allow_overpayments: input.allowOverpayments,
      overpayment_tolerance_cents: input.overpaymentToleranceCents,
    })
    .eq("id", input.organizationId);
  if (error) throw new Error("Não foi possível salvar as preferências.");
}
