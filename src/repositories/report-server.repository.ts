import "server-only";

import { z } from "zod";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import type { Json, ReportExportFormat, ReportKind } from "@/types/database";
import type { ReportFilters } from "@/validation/report";

const distributionSchema = z.object({
  label: z.string(),
  totalCents: z.number(),
});
const reportSchema = z.object({
  summary: z.object({
    predictedCents: z.number(),
    realizedCents: z.number(),
    varianceCents: z.number(),
    overdueCents: z.number(),
    averageApprovalHours: z.number(),
    reversedCents: z.number(),
    reversedCount: z.number(),
    totalCount: z.number(),
  }),
  categories: z.array(distributionSchema),
  suppliers: z.array(distributionSchema),
  rows: z.array(
    z.object({
      id: z.string(),
      rowType: z.enum(["account", "payment"]),
      eventDate: z.string(),
      description: z.string(),
      supplierName: z.string(),
      categoryName: z.string(),
      amountCents: z.number(),
      balanceCents: z.number(),
      status: z.string(),
      paymentMethod: z.string().nullable(),
      responsibleName: z.string(),
      reversedAt: z.string().nullable(),
      reversalReason: z.string().nullable(),
    }),
  ),
});
export type ManagementReport = z.infer<typeof reportSchema>;
export type ManagementReportRow = ManagementReport["rows"][number];

function rpcArgs(
  organizationId: string,
  businessDate: string,
  filters: ReportFilters,
  pageSize: number,
  actorUserId?: string,
) {
  return {
    p_organization_id: organizationId,
    p_date_from: filters.dateFrom,
    p_date_to: filters.dateTo,
    p_report_kind: filters.kind,
    p_business_date: businessDate,
    p_status: filters.status ?? null,
    p_supplier_id: filters.supplierId || null,
    p_category_id: filters.categoryId || null,
    p_payment_method: filters.paymentMethod ?? null,
    p_responsible_user_id: filters.responsibleUserId || null,
    p_page: filters.page,
    p_page_size: pageSize,
    p_actor_user_id: actorUserId ?? null,
  };
}

export async function getManagementReport(
  organizationId: string,
  businessDate: string,
  filters: ReportFilters,
  pageSize = 25,
): Promise<ManagementReport> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "get_management_report",
    rpcArgs(organizationId, businessDate, filters, pageSize),
  );
  if (error) throw new Error(error.message);
  return reportSchema.parse(data);
}

export async function getManagementReportAsAdmin(
  organizationId: string,
  actorUserId: string,
  businessDate: string,
  filters: ReportFilters,
  pageSize = 5000,
): Promise<ManagementReport> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "get_management_report",
    rpcArgs(organizationId, businessDate, filters, pageSize, actorUserId),
  );
  if (error) throw new Error(error.message);
  return reportSchema.parse(data);
}

export async function listReportLookups(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: suppliers }, { data: categories }, { data: members }] =
    await Promise.all([
      supabase
        .from("suppliers")
        .select("id,name")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("expense_categories")
        .select("id,name")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationId)
        .eq("status", "active"),
    ]);
  const userIds = (members ?? []).map((member) => member.user_id);
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", userIds)
        .order("full_name")
    : { data: [] };
  return {
    suppliers: suppliers ?? [],
    categories: categories ?? [],
    users: profiles ?? [],
  };
}

export async function enqueueReportExport(
  organizationId: string,
  kind: ReportKind,
  format: ReportExportFormat,
  filters: Json,
) {
  const { data, error } = await (
    await createSupabaseServerClient()
  ).rpc("enqueue_report_export", {
    p_organization_id: organizationId,
    p_report_kind: kind,
    p_format: format,
    p_filters: filters,
  });
  if (error) throw new Error(error.message);
  return data;
}
export async function recordImmediateReportExport(
  organizationId: string,
  kind: ReportKind,
  format: ReportExportFormat,
  filters: Json,
  rowCount: number,
) {
  const { error } = await (
    await createSupabaseServerClient()
  ).rpc("record_immediate_report_export", {
    p_organization_id: organizationId,
    p_report_kind: kind,
    p_format: format,
    p_filters: filters,
    p_row_count: rowCount,
  });
  if (error) throw new Error(error.message);
}
export async function listReportExports(organizationId: string) {
  const { data, error } = await (
    await createSupabaseServerClient()
  )
    .from("report_exports")
    .select(
      "id,report_kind,format,status,row_count,error_message,expires_at,created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return [];
  return data ?? [];
}
