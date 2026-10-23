import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { ManagementReport } from "@/repositories/report-server.repository";
import { createReportCsv, createReportPdf } from "./report-export.service";

const report: ManagementReport = {
  summary: {
    predictedCents: 12345,
    realizedCents: 10000,
    varianceCents: 2345,
    overdueCents: 0,
    averageApprovalHours: 2.5,
    reversedCents: 0,
    reversedCount: 0,
    totalCount: 1,
  },
  categories: [],
  suppliers: [],
  rows: [
    {
      id: "1",
      rowType: "account" as const,
      eventDate: "2026-08-10",
      description: "Água e manutenção",
      supplierName: "São João",
      categoryName: "Serviços",
      amountCents: 12345,
      balanceCents: 2345,
      status: "pending",
      paymentMethod: null,
      responsibleName: "Luíz",
      reversedAt: null,
      reversalReason: null,
    },
  ],
};
describe("exportações gerenciais", () => {
  it("gera CSV pt-BR com BOM, separador e caracteres portugueses", () => {
    const bytes = createReportCsv(report);
    const text = new TextDecoder().decode(bytes);
    expect([...bytes.slice(0, 3)]).toEqual([239, 187, 191]);
    expect(text.startsWith("sep=;")).toBe(true);
    expect(text).toContain("Água e manutenção");
    expect(text).toContain("123,45");
  });
  it("protege células CSV contra fórmulas", () => {
    const text = new TextDecoder().decode(
      createReportCsv({
        ...report,
        rows: [{ ...report.rows[0]!, description: '=HYPERLINK("x")' }],
      }),
    );
    expect(text).toContain("'=HYPERLINK");
  });
  it("gera PDF válido inclusive sem registros", async () => {
    const bytes = await createReportPdf({
      organizationName: "Empresa São José",
      filters: {
        dateFrom: "2026-08-01",
        dateTo: "2026-08-31",
        kind: "forecast",
        page: 1,
      },
      report: { ...report, rows: [] },
      generatedAt: new Date("2026-08-10T12:00:00Z"),
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
  });
});
