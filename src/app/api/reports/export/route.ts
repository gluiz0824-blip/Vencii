import { getApiWorkspace } from "@/dal/api-workspace";
import { todayInTimeZone } from "@/domain/shared/timezone";
import {
  enqueueReportExport,
  getManagementReport,
  recordImmediateReportExport,
} from "@/repositories/report-server.repository";
import {
  createReportCsv,
  createReportPdf,
  exportFileName,
} from "@/services/reports/report-export.service";
import { reportFilterSchema, reportFiltersToJson } from "@/validation/report";

export const maxDuration = 60;
export async function GET(request: Request) {
  const workspace = await getApiWorkspace();
  if (!workspace)
    return Response.json(
      { message: "Sessão ou organização inválida." },
      { status: 401 },
    );
  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  if (format !== "csv" && format !== "pdf")
    return Response.json({ message: "Formato inválido." }, { status: 400 });
  const parsed = reportFilterSchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!parsed.success)
    return Response.json({ message: "Filtros inválidos." }, { status: 400 });
  const filters = {
    ...parsed.data,
    supplierId: parsed.data.supplierId || undefined,
    categoryId: parsed.data.categoryId || undefined,
    responsibleUserId: parsed.data.responsibleUserId || undefined,
  };
  const today = todayInTimeZone(workspace.activeOrganization.timezone);
  const report = await getManagementReport(
    workspace.activeOrganization.id,
    today,
    { ...filters, page: 1 },
    5000,
  );
  const filterJson = reportFiltersToJson(filters);
  if (report.summary.totalCount > 2000) {
    await enqueueReportExport(
      workspace.activeOrganization.id,
      filters.kind,
      format,
      filterJson,
    );
    return Response.json(
      {
        queued: true,
        message:
          "O relatório é grande e será processado em segundo plano. Você receberá uma notificação quando estiver pronto.",
      },
      { status: 202 },
    );
  }
  const bytes =
    format === "csv"
      ? createReportCsv(report)
      : await createReportPdf({
          organizationName: workspace.activeOrganization.tradeName,
          filters,
          report,
          generatedAt: new Date(),
        });
  await recordImmediateReportExport(
    workspace.activeOrganization.id,
    filters.kind,
    format,
    filterJson,
    report.summary.totalCount,
  );
  const fileName = exportFileName(
    filters.kind,
    format,
    filters.dateFrom,
    filters.dateTo,
  );
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type":
        format === "csv" ? "text/csv; charset=utf-8" : "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
