import { z } from "zod";

import type {
  Json,
  PaymentMethod,
  PayableStatus,
  ReportKind,
} from "@/types/database";

export const reportKinds = [
  "forecast",
  "paid",
  "overdue",
  "supplier",
  "category",
  "variance",
  "approvals",
  "payments",
] as const;
const payableStatuses = [
  "draft",
  "pending",
  "awaiting_approval",
  "approved",
  "scheduled",
  "partial",
  "paid",
  "overdue",
  "rejected",
  "canceled",
] as const;
const paymentMethods = [
  "boleto",
  "pix",
  "transferencia",
  "debito_automatico",
  "cartao",
  "dinheiro",
  "outro",
] as const;

export const reportFilterSchema = z
  .object({
    dateFrom: z.iso.date(),
    dateTo: z.iso.date(),
    kind: z.enum(reportKinds).default("forecast"),
    status: z.enum(payableStatuses).optional(),
    supplierId: z.union([z.uuid(), z.literal("")]).optional(),
    categoryId: z.union([z.uuid(), z.literal("")]).optional(),
    paymentMethod: z.enum(paymentMethods).optional(),
    responsibleUserId: z.union([z.uuid(), z.literal("")]).optional(),
    page: z.coerce.number().int().min(1).default(1),
  })
  .refine((value) => value.dateTo >= value.dateFrom, {
    message: "O fim do período deve ser posterior ao início.",
    path: ["dateTo"],
  });

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  kind: ReportKind;
  status?: PayableStatus;
  supplierId?: string;
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  responsibleUserId?: string;
  page: number;
}

export function reportFiltersToJson(filters: ReportFilters): Json {
  return {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    kind: filters.kind,
    status: filters.status ?? null,
    supplierId: filters.supplierId || null,
    categoryId: filters.categoryId || null,
    paymentMethod: filters.paymentMethod ?? null,
    responsibleUserId: filters.responsibleUserId || null,
  };
}
