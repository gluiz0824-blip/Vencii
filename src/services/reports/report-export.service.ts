import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { ManagementReport } from "@/repositories/report-server.repository";
import type { ReportFilters } from "@/validation/report";

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  awaiting_approval: "Aguardando aprovação",
  approved: "Aprovada",
  scheduled: "Agendada",
  partial: "Parcial",
  paid: "Paga",
  overdue: "Vencida",
  rejected: "Rejeitada",
  canceled: "Cancelada",
  draft: "Rascunho",
  active: "Ativo",
  reversed: "Estornado",
};
const methodLabels: Record<string, string> = {
  boleto: "Boleto",
  pix: "Pix",
  transferencia: "Transferência",
  debito_automatico: "Débito automático",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

function csvCell(value: string | number) {
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}
function date(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function createReportCsv(report: ManagementReport): Uint8Array {
  const headers = [
    "Data",
    "Descrição",
    "Fornecedor",
    "Categoria",
    "Valor",
    "Saldo",
    "Status",
    "Forma de pagamento",
    "Responsável",
    "Estornado em",
    "Motivo do estorno",
  ];
  const rows = report.rows.map((row) => [
    date(row.eventDate),
    row.description,
    row.supplierName,
    row.categoryName,
    (row.amountCents / 100).toFixed(2).replace(".", ","),
    (row.balanceCents / 100).toFixed(2).replace(".", ","),
    statusLabels[row.status] ?? row.status,
    row.paymentMethod
      ? (methodLabels[row.paymentMethod] ?? row.paymentMethod)
      : "",
    row.responsibleName,
    row.reversedAt
      ? new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(row.reversedAt))
      : "",
    row.reversalReason ?? "",
  ]);
  const csv =
    "\uFEFFsep=;\r\n" +
    [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
  return new TextEncoder().encode(csv);
}

function safePdfText(value: string) {
  return value.replace(/[–—]/g, "-").replace(/[^\x20-\x7EÀ-ÿ]/g, "?");
}
function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

export async function createReportPdf(input: {
  organizationName: string;
  filters: ReportFilters;
  report: ManagementReport;
  generatedAt: Date;
}): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const blue = rgb(0.03, 0.25, 0.62),
    dark = rgb(0.05, 0.1, 0.2),
    muted = rgb(0.38, 0.43, 0.52),
    line = rgb(0.86, 0.88, 0.91);
  const margin = 42,
    width = 595,
    height = 842;
  let page = document.addPage([width, height]);
  let y = height - margin;
  function text(
    value: string,
    x: number,
    size = 9,
    font = regular,
    color = dark,
  ) {
    page.drawText(safePdfText(value), { x, y, size, font, color });
  }
  function header() {
    text("Vencii", margin, 17, bold, blue);
    y -= 24;
    text("Relatório gerencial", margin, 20, bold, dark);
    y -= 18;
    text(input.organizationName, margin, 10, bold, dark);
    y -= 15;
    text(
      `Período: ${date(input.filters.dateFrom)} a ${date(input.filters.dateTo)} | Gerado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(input.generatedAt)}`,
      margin,
      8,
      regular,
      muted,
    );
    y -= 20;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: line,
    });
    y -= 22;
  }
  function newPage() {
    page = document.addPage([width, height]);
    y = height - margin;
    header();
  }
  header();
  const summary = input.report.summary;
  const metrics: Array<[string, string]> = [
    ["Previsto", money(summary.predictedCents)],
    ["Realizado", money(summary.realizedCents)],
    ["Diferença", money(summary.varianceCents)],
    ["Vencido", money(summary.overdueCents)],
  ];
  metrics.forEach(([label, value], index) => {
    const x = margin + (index % 2) * 255;
    if (index === 2) y -= 48;
    text(label, x, 8, regular, muted);
    y -= 13;
    text(value, x, 14, bold, dark);
    y += 13;
  });
  y -= 34;
  text(
    `Tempo médio de aprovação: ${summary.averageApprovalHours.toLocaleString("pt-BR")} horas`,
    margin,
    9,
    regular,
    muted,
  );
  y -= 24;
  text("Detalhamento", margin, 13, bold, dark);
  y -= 18;
  const columns = [
    { x: margin, w: 58, label: "Data" },
    { x: 104, w: 150, label: "Descrição" },
    { x: 258, w: 100, label: "Fornecedor" },
    { x: 362, w: 76, label: "Status" },
    { x: 442, w: 110, label: "Valor" },
  ];
  function tableHeader() {
    columns.forEach((column) => text(column.label, column.x, 8, bold, muted));
    y -= 10;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: line,
    });
    y -= 15;
  }
  tableHeader();
  if (!input.report.rows.length) {
    text(
      "Nenhum registro encontrado para os filtros selecionados.",
      margin,
      10,
      regular,
      muted,
    );
  }
  for (const row of input.report.rows) {
    if (y < 62) {
      newPage();
      text("Detalhamento (continuação)", margin, 12, bold, dark);
      y -= 18;
      tableHeader();
    }
    text(date(row.eventDate), columns[0]!.x, 8);
    text(truncate(row.description, 30), columns[1]!.x, 8);
    text(truncate(row.supplierName, 19), columns[2]!.x, 8);
    text(
      truncate(statusLabels[row.status] ?? row.status, 16),
      columns[3]!.x,
      8,
    );
    text(money(row.amountCents), columns[4]!.x, 8, bold);
    y -= 20;
  }
  const pages = document.getPages();
  pages.forEach((item, index) => {
    item.drawText(`Vencii | Página ${index + 1} de ${pages.length}`, {
      x: margin,
      y: 24,
      size: 7,
      font: regular,
      color: muted,
    });
  });
  return document.save();
}

export function exportFileName(
  kind: string,
  format: "csv" | "pdf",
  dateFrom: string,
  dateTo: string,
) {
  return `vencii-${kind}-${dateFrom}-${dateTo}.${format}`;
}
