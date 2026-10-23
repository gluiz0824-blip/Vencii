import {
  Ban,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock3,
  FilePenLine,
  CalendarCheck,
  CircleDollarSign,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type FinancialStatus =
  | "draft"
  | "pending"
  | "awaiting_approval"
  | "approved"
  | "scheduled"
  | "partial"
  | "paid"
  | "overdue"
  | "canceled"
  | "rejected";

const statusConfig: Record<
  FinancialStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  draft: {
    label: "Rascunho",
    icon: FilePenLine,
    className:
      "border-status-canceled/25 bg-status-canceled-muted text-status-canceled-foreground",
  },
  pending: {
    label: "Pendente",
    icon: CircleDashed,
    className:
      "border-status-pending/25 bg-status-pending-muted text-status-pending-foreground",
  },
  awaiting_approval: {
    label: "Aguardando aprovação",
    icon: Clock3,
    className:
      "border-status-awaiting/25 bg-status-awaiting-muted text-status-awaiting-foreground",
  },
  approved: {
    label: "Aprovado",
    icon: ShieldCheck,
    className:
      "border-status-approved/25 bg-status-approved-muted text-status-approved-foreground",
  },
  scheduled: {
    label: "Agendado",
    icon: CalendarCheck,
    className:
      "border-status-awaiting/25 bg-status-awaiting-muted text-status-awaiting-foreground",
  },
  partial: {
    label: "Pago parcialmente",
    icon: CircleDollarSign,
    className:
      "border-status-awaiting/25 bg-status-awaiting-muted text-status-awaiting-foreground",
  },
  paid: {
    label: "Pago",
    icon: CircleCheck,
    className:
      "border-status-paid/25 bg-status-paid-muted text-status-paid-foreground",
  },
  overdue: {
    label: "Vencido",
    icon: TriangleAlert,
    className:
      "border-status-overdue/25 bg-status-overdue-muted text-status-overdue-foreground",
  },
  canceled: {
    label: "Cancelado",
    icon: Ban,
    className:
      "border-status-canceled/25 bg-status-canceled-muted text-status-canceled-foreground",
  },
  rejected: {
    label: "Rejeitado",
    icon: CircleX,
    className:
      "border-status-rejected/25 bg-status-rejected-muted text-status-rejected-foreground",
  },
};

interface StatusBadgeProps {
  status: FinancialStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn("h-6 gap-1.5 rounded-md px-2", config.className, className)}
    >
      <Icon aria-hidden="true" />
      {config.label}
    </Badge>
  );
}
