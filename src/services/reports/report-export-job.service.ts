import "server-only";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin";
import { todayInTimeZone } from "@/domain/shared/timezone";
import { getManagementReportAsAdmin } from "@/repositories/report-server.repository";
import {
  createReportCsv,
  createReportPdf,
} from "@/services/reports/report-export.service";
import { reportFilterSchema } from "@/validation/report";

export async function runReportExportJob() {
  const supabase = createSupabaseAdminClient();
  const { data: expired } = await supabase.rpc("expire_report_exports");
  if (expired?.length)
    await supabase.storage.from("report-exports").remove(expired);
  const { data: jobs, error } = await supabase.rpc("claim_report_exports", {
    p_limit: 5,
  });
  if (error) throw new Error(error.message);
  let completed = 0,
    failed = 0;
  for (const job of jobs ?? []) {
    try {
      const filters = reportFilterSchema.parse(job.filters);
      const { data: organization, error: organizationError } = await supabase
        .from("organizations")
        .select("trade_name,timezone")
        .eq("id", job.organization_id)
        .single();
      if (organizationError) throw new Error(organizationError.message);
      const report = await getManagementReportAsAdmin(
        job.organization_id,
        job.requested_by,
        todayInTimeZone(organization.timezone),
        {
          ...filters,
          supplierId: filters.supplierId || undefined,
          categoryId: filters.categoryId || undefined,
          responsibleUserId: filters.responsibleUserId || undefined,
          page: 1,
        },
        5000,
      );
      if (report.summary.totalCount > 5000)
        throw new Error(
          "O relatório excede o limite de 5.000 linhas por arquivo.",
        );
      const bytes =
        job.format === "csv"
          ? createReportCsv(report)
          : await createReportPdf({
              organizationName: organization.trade_name,
              filters,
              report,
              generatedAt: new Date(),
            });
      const path = `${job.organization_id}/${job.id}.${job.format}`;
      const { error: uploadError } = await supabase.storage
        .from("report-exports")
        .upload(path, bytes, {
          contentType: job.format === "csv" ? "text/csv" : "application/pdf",
          upsert: false,
        });
      if (uploadError) throw new Error(uploadError.message);
      const { error: finishError } = await supabase.rpc(
        "finish_report_export",
        {
          p_export_id: job.id,
          p_success: true,
          p_storage_path: path,
          p_size_bytes: bytes.length,
          p_row_count: report.summary.totalCount,
          p_error: null,
        },
      );
      if (finishError) throw new Error(finishError.message);
      completed++;
    } catch (error) {
      await supabase.rpc("finish_report_export", {
        p_export_id: job.id,
        p_success: false,
        p_storage_path: null,
        p_size_bytes: null,
        p_row_count: null,
        p_error:
          error instanceof Error ? error.message : "Falha na exportação.",
      });
      failed++;
    }
  }
  return {
    claimed: jobs?.length ?? 0,
    completed,
    failed,
    expired: expired?.length ?? 0,
  };
}
