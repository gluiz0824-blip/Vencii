import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import type { PayableStatus } from "@/types/database";

const summarySchema = z.object({
  totalCount: z.number(),
  dueTodayCents: z.number(),
  dueNext7DaysCents: z.number(),
  dueNext30DaysCents: z.number(),
  overdueCents: z.number(),
  awaitingApprovalCents: z.number(),
  paidThisMonthCents: z.number(),
});

const distributionItemSchema = z.object({
  label: z.string(),
  totalCents: z.number(),
});

const distributionsSchema = z.object({
  categories: z.array(distributionItemSchema),
  suppliers: z.array(distributionItemSchema),
});

const forecastSchema = z.array(
  z.object({ periodStart: z.string(), totalCents: z.number() }),
);

const alertsSchema = z.object({
  possibleDuplicates: z.number(),
  documentsNeedsReview: z.number(),
  documentsFailed: z.number(),
});

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

const calendarAccountSchema = z.object({
  id: z.string(),
  description: z.string(),
  amountCents: z.number(),
  status: z.enum(payableStatuses),
  supplierName: z.string().nullable(),
  categoryName: z.string().nullable(),
});

export type FinancialSummary = z.infer<typeof summarySchema>;
export type ForecastPoint = z.infer<typeof forecastSchema>[number];
export type DistributionItem = z.infer<typeof distributionItemSchema>;
export type FinancialAlerts = z.infer<typeof alertsSchema>;
export type CalendarAccount = z.infer<typeof calendarAccountSchema>;

export interface CalendarDay {
  dueDate: string;
  accountCount: number;
  totalCents: number;
  accounts: CalendarAccount[];
}

export async function getFinancialSummary(
  organizationId: string,
  businessDate: string,
): Promise<FinancialSummary> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "get_financial_dashboard_summary",
    { p_organization_id: organizationId, p_business_date: businessDate },
  );
  if (error) throw new Error(error.message);
  return summarySchema.parse(data);
}

export async function getFinancialForecast(
  organizationId: string,
  businessDate: string,
): Promise<ForecastPoint[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_financial_forecast", {
    p_organization_id: organizationId,
    p_business_date: businessDate,
  });
  if (error) throw new Error(error.message);
  return forecastSchema.parse(data);
}

export async function getFinancialDistributions(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_financial_distributions", {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(error.message);
  return distributionsSchema.parse(data);
}

export async function getFinancialAlerts(
  organizationId: string,
): Promise<FinancialAlerts> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_financial_alerts", {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(error.message);
  return alertsSchema.parse(data);
}

export async function getPayablesCalendar(input: {
  organizationId: string;
  dateFrom: string;
  dateTo: string;
  status?: PayableStatus;
  supplierId?: string;
  categoryId?: string;
}): Promise<CalendarDay[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_payables_calendar", {
    p_organization_id: input.organizationId,
    p_date_from: input.dateFrom,
    p_date_to: input.dateTo,
    p_status: input.status ?? null,
    p_supplier_id: input.supplierId || null,
    p_category_id: input.categoryId || null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((day) => ({
    dueDate: day.due_date,
    accountCount: day.account_count,
    totalCents: day.total_cents,
    accounts: z.array(calendarAccountSchema).parse(day.accounts),
  }));
}
