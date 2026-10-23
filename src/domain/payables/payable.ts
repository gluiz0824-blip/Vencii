import type {
  OrganizationRole,
  PayableDocumentType,
  PayableSource,
  PayableStatus,
} from "@/types/database";

export const PAYABLE_DOCUMENT_LABELS: Record<PayableDocumentType, string> = {
  boleto: "Boleto",
  pix: "Pix",
  transferencia: "Transferência",
  cartao: "Cartão",
  imposto: "Imposto",
  outro: "Outro",
};

export const PAYABLE_STATUS_LABELS: Record<PayableStatus, string> = {
  draft: "Rascunho",
  pending: "Pendente",
  awaiting_approval: "Aguardando aprovação",
  approved: "Aprovado",
  scheduled: "Agendado",
  partial: "Pago parcialmente",
  paid: "Pago",
  overdue: "Vencido",
  rejected: "Rejeitado",
  canceled: "Cancelado",
};

export const PAYABLE_SOURCE_LABELS: Record<PayableSource, string> = {
  manual: "Manual",
  upload: "Upload",
  email: "E-mail",
  import: "Importação",
};

export const PAYABLE_WRITE_ROLES = ["owner", "admin", "operator"] as const;

export function canEditFinancialFields(status: PayableStatus): boolean {
  return !(
    ["partial", "paid", "canceled", "rejected"] as PayableStatus[]
  ).includes(status);
}

export function canRegisterPayment(
  role: OrganizationRole,
  status: PayableStatus,
): boolean {
  return (
    (["owner", "admin"] as OrganizationRole[]).includes(role) &&
    (
      [
        "pending",
        "awaiting_approval",
        "approved",
        "scheduled",
        "partial",
        "overdue",
      ] as PayableStatus[]
    ).includes(status)
  );
}
