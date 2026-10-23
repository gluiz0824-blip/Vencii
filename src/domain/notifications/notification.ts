import type { NotificationType, ReminderEventType } from "@/types/database";

export const notificationLabels: Record<ReminderEventType, string> = {
  payable_due_7_days: "Conta vence em 7 dias",
  payable_due_3_days: "Conta vence em 3 dias",
  payable_due_tomorrow: "Conta vence amanhã",
  payable_due_today: "Conta vence hoje",
  payable_overdue: "Conta vencida",
  approval_requested: "Nova aprovação pendente",
  approval_due_soon: "Aprovação próxima do vencimento",
  approval_completed: "Conta aprovada",
  approval_rejected: "Conta rejeitada",
  document_extraction_failed: "Falha na extração de documento",
};

export function notificationHref(input: {
  type: NotificationType;
  entityId: string | null;
}): string {
  if (!input.entityId) return "/app/notificacoes";
  if (input.type.startsWith("payable_"))
    return `/app/contas-a-pagar/${input.entityId}`;
  if (input.type.startsWith("approval_")) return "/app/aprovacoes";
  if (input.type === "report_export_ready") return "/app/relatorios";
  return "/app/notificacoes";
}
