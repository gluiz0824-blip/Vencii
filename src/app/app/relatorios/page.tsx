import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import {
  BarChart3,
  Clock3,
  Download,
  History,
  Scale,
  TrendingDown,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/product/empty-state";
import { MetricCard } from "@/components/product/metric-card";
import { PageHeader } from "@/components/product/page-header";
import { ReportDistributionChart } from "@/components/reports/report-chart";
import { ReportExportButtons } from "@/components/reports/report-export-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireWorkspace } from "@/dal/workspace";
import {
  businessDate,
  formatBusinessDate,
} from "@/domain/shared/business-date";
import { moneyInCents } from "@/domain/shared/money";
import { todayInTimeZone } from "@/domain/shared/timezone";
import {
  getManagementReport,
  listReportExports,
  listReportLookups,
} from "@/repositories/report-server.repository";
import { reportFilterSchema, type ReportFilters } from "@/validation/report";

export const metadata: Metadata = { title: "Relatórios" };
type SearchParams = Record<string, string | string[] | undefined>;
const kinds = [
  { value: "forecast", label: "Contas previstas" },
  { value: "paid", label: "Contas pagas" },
  { value: "overdue", label: "Contas vencidas" },
  { value: "supplier", label: "Valores por fornecedor" },
  { value: "category", label: "Valores por categoria" },
  { value: "variance", label: "Previsto x realizado" },
  { value: "approvals", label: "Tempo de aprovação" },
  { value: "payments", label: "Pagamentos e estornos" },
] as const;
const statuses = [
  { value: "", label: "Todos (exceto cancelados e rejeitados)" },
  { value: "pending", label: "Pendente" },
  { value: "awaiting_approval", label: "Aguardando aprovação" },
  { value: "approved", label: "Aprovada" },
  { value: "scheduled", label: "Agendada" },
  { value: "partial", label: "Parcial" },
  { value: "paid", label: "Paga" },
  { value: "overdue", label: "Vencida" },
  { value: "rejected", label: "Rejeitada" },
  { value: "canceled", label: "Cancelada" },
] as const;
const methods = [
  { value: "", label: "Todas" },
  { value: "boleto", label: "Boleto" },
  { value: "pix", label: "Pix" },
  { value: "transferencia", label: "Transferência" },
  { value: "debito_automatico", label: "Débito automático" },
  { value: "cartao", label: "Cartão" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "outro", label: "Outro" },
] as const;
const statusLabels = Object.fromEntries(
  statuses.map((item) => [item.value, item.label]),
);
function raw(params: SearchParams, key: string) {
  return typeof params[key] === "string" ? params[key] : undefined;
}
function pageLink(params: URLSearchParams, page: number) {
  const copy = new URLSearchParams(params);
  copy.set("page", String(page));
  return `/app/relatorios?${copy}`;
}
function Money({ cents }: { cents: number }) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(moneyInCents(cents) / 100);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [workspace, params] = await Promise.all([
    requireWorkspace(),
    searchParams,
  ]);
  const today = todayInTimeZone(workspace.activeOrganization.timezone);
  const monthStart = format(startOfMonth(parseISO(today)), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(parseISO(monthStart)), "yyyy-MM-dd");
  const parsed = reportFilterSchema.safeParse({
    dateFrom: raw(params, "dateFrom") ?? monthStart,
    dateTo: raw(params, "dateTo") ?? monthEnd,
    kind: raw(params, "kind") ?? "forecast",
    status: raw(params, "status") || undefined,
    supplierId: raw(params, "supplierId") ?? "",
    categoryId: raw(params, "categoryId") ?? "",
    paymentMethod: raw(params, "paymentMethod") || undefined,
    responsibleUserId: raw(params, "responsibleUserId") ?? "",
    page: raw(params, "page") ?? "1",
  });
  const filters: ReportFilters = parsed.success
    ? {
        ...parsed.data,
        supplierId: parsed.data.supplierId || undefined,
        categoryId: parsed.data.categoryId || undefined,
        responsibleUserId: parsed.data.responsibleUserId || undefined,
      }
    : {
        dateFrom: monthStart,
        dateTo: monthEnd,
        kind: "forecast" as const,
        page: 1,
      };
  const [report, lookups, exports] = await Promise.all([
    getManagementReport(workspace.activeOrganization.id, today, filters, 25),
    listReportLookups(workspace.activeOrganization.id),
    listReportExports(workspace.activeOrganization.id),
  ]);
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && key !== "page") query.set(key, String(value));
  });
  const pages = Math.max(1, Math.ceil(report.summary.totalCount / 25));
  const distribution =
    filters.kind === "category" ? report.categories : report.suppliers;
  const showChart =
    ["supplier", "category"].includes(filters.kind) && distribution.length > 0;
  return (
    <section className="app-page space-y-[var(--space-section)]">
      <PageHeader
        title="Relatórios"
        description="Analise compromissos e pagamentos reais sem caráter de demonstração contábil."
        breadcrumbs={[{ label: "Relatórios" }]}
        actions={<ReportExportButtons query={query.toString()} />}
      />
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Os mesmos filtros são aplicados à tela, ao CSV e ao PDF.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
          >
            <Field label="Relatório">
              <select
                name="kind"
                defaultValue={filters.kind}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                {kinds.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data inicial">
              <Input
                type="date"
                name="dateFrom"
                defaultValue={filters.dateFrom}
              />
            </Field>
            <Field label="Data final">
              <Input type="date" name="dateTo" defaultValue={filters.dateTo} />
            </Field>
            <Field label="Status">
              <select
                name="status"
                defaultValue={filters.status ?? ""}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                {statuses.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fornecedor">
              <select
                name="supplierId"
                defaultValue={filters.supplierId ?? ""}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="">Todos</option>
                {lookups.suppliers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Categoria">
              <select
                name="categoryId"
                defaultValue={filters.categoryId ?? ""}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="">Todas</option>
                {lookups.categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Forma de pagamento">
              <select
                name="paymentMethod"
                defaultValue={filters.paymentMethod ?? ""}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                {methods.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Responsável">
              <select
                name="responsibleUserId"
                defaultValue={filters.responsibleUserId ?? ""}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="">Todos</option>
                {lookups.users.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.full_name || "Sem nome"}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
              <Button type="submit">Aplicar filtros</Button>
              <Button asChild variant="ghost">
                <Link href="/app/relatorios">Limpar</Link>
              </Button>
            </div>
          </form>
          {!parsed.success && (
            <p className="text-destructive mt-3 text-sm">
              Algum filtro era inválido e o período atual foi restaurado.
            </p>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Previsto"
          value={<Money cents={report.summary.predictedCents} />}
          helper="Contas no período, exceto canceladas e rejeitadas"
          icon={BarChart3}
        />
        <MetricCard
          label="Realizado"
          value={<Money cents={report.summary.realizedCents} />}
          helper="Pagamentos ativos no período"
          icon={TrendingDown}
        />
        <MetricCard
          label="Diferença"
          value={<Money cents={report.summary.varianceCents} />}
          helper="Previsto menos realizado"
          icon={Scale}
        />
        <MetricCard
          label="Tempo médio de aprovação"
          value={`${report.summary.averageApprovalHours.toLocaleString("pt-BR")} h`}
          helper="Solicitação até conclusão"
          icon={Clock3}
        />
      </div>
      {showChart && (
        <Card>
          <CardHeader>
            <CardTitle>
              {filters.kind === "category"
                ? "Valores por categoria"
                : "Valores por fornecedor"}
            </CardTitle>
            <CardDescription>
              Comparação dos maiores valores previstos no período.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReportDistributionChart
              data={distribution}
              label="Distribuição de valores do relatório"
            />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento</CardTitle>
          <CardDescription>
            {report.summary.totalCount}{" "}
            {report.summary.totalCount === 1
              ? "registro encontrado"
              : "registros encontrados"}
            . Paginação processada no servidor.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {report.rows.length ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {[
                        "Data",
                        "Descrição",
                        "Fornecedor",
                        "Categoria",
                        "Status",
                        "Valor",
                        "Responsável",
                      ].map((item) => (
                        <th
                          key={item}
                          className="px-4 py-3 text-start font-medium"
                        >
                          {item}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatBusinessDate(businessDate(row.eventDate))}
                        </td>
                        <td className="max-w-64 px-4 py-3 font-medium">
                          {row.description}
                        </td>
                        <td className="px-4 py-3">{row.supplierName}</td>
                        <td className="px-4 py-3">{row.categoryName}</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              row.status === "reversed"
                                ? "destructive"
                                : "outline"
                            }
                          >
                            {statusLabels[row.status] ?? row.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-end font-mono whitespace-nowrap">
                          <Money cents={row.amountCents} />
                        </td>
                        <td className="px-4 py-3">{row.responsibleName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y md:hidden">
                {report.rows.map((row) => (
                  <article key={row.id} className="space-y-2 p-4">
                    <div className="flex justify-between gap-3">
                      <p className="font-medium">{row.description}</p>
                      <span className="font-mono font-semibold whitespace-nowrap">
                        <Money cents={row.amountCents} />
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {formatBusinessDate(businessDate(row.eventDate))} ·{" "}
                      {row.supplierName}
                    </p>
                    <Badge
                      variant={
                        row.status === "reversed" ? "destructive" : "outline"
                      }
                    >
                      {statusLabels[row.status] ?? row.status}
                    </Badge>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="Nenhum dado para este relatório"
              description="Altere o período ou remova alguns filtros para procurar outros registros."
              icon={BarChart3}
            />
          )}
        </CardContent>
      </Card>
      {pages > 1 && (
        <nav
          aria-label="Paginação do relatório"
          className="flex items-center justify-between"
        >
          <Button asChild variant="outline" aria-disabled={filters.page <= 1}>
            <Link href={pageLink(query, Math.max(1, filters.page - 1))}>
              Anterior
            </Link>
          </Button>
          <span className="text-muted-foreground text-sm">
            Página {Math.min(filters.page, pages)} de {pages}
          </span>
          <Button
            asChild
            variant="outline"
            aria-disabled={filters.page >= pages}
          >
            <Link href={pageLink(query, Math.min(pages, filters.page + 1))}>
              Próxima
            </Link>
          </Button>
        </nav>
      )}
      {exports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-5" />
              Exportações recentes
            </CardTitle>
            <CardDescription>
              Arquivos grandes ficam disponíveis de forma privada por 24 horas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {exports.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">
                    {
                      kinds.find((kind) => kind.value === item.report_kind)
                        ?.label
                    }{" "}
                    · {item.format.toUpperCase()}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(item.created_at))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      item.status === "failed" ? "destructive" : "outline"
                    }
                  >
                    {item.status === "completed"
                      ? "Pronto"
                      : item.status === "pending"
                        ? "Na fila"
                        : item.status === "processing"
                          ? "Processando"
                          : item.status === "failed"
                            ? "Falhou"
                            : "Expirado"}
                  </Badge>
                  {item.status === "completed" && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/api/reports/exports/${item.id}`}>
                        <Download />
                        Baixar
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}
