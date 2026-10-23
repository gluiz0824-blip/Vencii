import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  CircleDollarSign,
  FileSearch,
  ReceiptText,
  TrendingDown,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  DistributionChart,
  ForecastChart,
} from "@/components/dashboard/financial-charts";
import { CurrencyDisplay } from "@/components/product/currency-display";
import { DateDisplay } from "@/components/product/date-display";
import { EmptyState } from "@/components/product/empty-state";
import { MetricCard } from "@/components/product/metric-card";
import { PageHeader } from "@/components/product/page-header";
import { StatusBadge } from "@/components/product/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireWorkspace } from "@/dal/workspace";
import { businessDate } from "@/domain/shared/business-date";
import { moneyInCents } from "@/domain/shared/money";
import { todayInTimeZone } from "@/domain/shared/timezone";
import {
  listAccountsPayable,
  markOrganizationAccountsOverdue,
  type PayableListItem,
} from "@/repositories/accounts-payable-server.repository";
import {
  getFinancialAlerts,
  getFinancialDistributions,
  getFinancialForecast,
  getFinancialSummary,
} from "@/repositories/financial-dashboard-server.repository";

export const metadata: Metadata = { title: "Visão geral" };

const forecastStatuses = [
  "pending",
  "awaiting_approval",
  "approved",
  "scheduled",
  "partial",
] as const;

export default async function DashboardPage() {
  const { activeOrganization } = await requireWorkspace();
  const organizationId = activeOrganization.id;
  const today = todayInTimeZone(activeOrganization.timezone);

  await markOrganizationAccountsOverdue(organizationId, today).catch(
    () => undefined,
  );

  const [summary, forecast, distributions, alerts, upcoming, overdue] =
    await Promise.allSettled([
      getFinancialSummary(organizationId, today),
      getFinancialForecast(organizationId, today),
      getFinancialDistributions(organizationId),
      getFinancialAlerts(organizationId),
      listAccountsPayable(organizationId, {
        dueFrom: today,
        statuses: [...forecastStatuses],
        sort: "due_date",
        direction: "asc",
        page: 1,
        pageSize: 6,
      }),
      listAccountsPayable(organizationId, {
        dueTo: today,
        statuses: ["overdue"],
        sort: "due_date",
        direction: "asc",
        page: 1,
        pageSize: 6,
      }),
    ]);

  const isEmpty =
    summary.status === "fulfilled" && summary.value.totalCount === 0;

  return (
    <section className="app-page space-y-[var(--space-section)]">
      <PageHeader
        title="Visão geral"
        description={`Acompanhe os compromissos financeiros de ${activeOrganization.tradeName}.`}
        breadcrumbs={[{ label: "Visão geral" }]}
        actions={
          <Button asChild>
            <Link href="/app/contas-a-pagar/nova">
              <ReceiptText /> Nova conta
            </Link>
          </Button>
        }
      />

      {summary.status === "fulfilled" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MetricCard
            label="A pagar hoje"
            value={<Money cents={summary.value.dueTodayCents} />}
            helper="Vencimentos na data de hoje"
            icon={CircleDollarSign}
          />
          <MetricCard
            label="Próximos 7 dias"
            value={<Money cents={summary.value.dueNext7DaysCents} />}
            helper="Após hoje, até 7 dias"
            icon={CalendarClock}
          />
          <MetricCard
            label="Próximos 30 dias"
            value={<Money cents={summary.value.dueNext30DaysCents} />}
            helper="Após hoje, até 30 dias"
            icon={CalendarDays}
          />
          <MetricCard
            label="Total vencido"
            value={<Money cents={summary.value.overdueCents} />}
            helper="Compromissos em atraso"
            icon={AlertTriangle}
          />
          <MetricCard
            label="Aguardando aprovação"
            value={<Money cents={summary.value.awaitingApprovalCents} />}
            helper="Dependem de uma decisão"
            icon={CheckCheck}
          />
          <MetricCard
            label="Pago no mês"
            value={<Money cents={summary.value.paidThisMonthCents} />}
            helper="Realizado no mês atual"
            icon={TrendingDown}
          />
        </div>
      ) : (
        <PanelError title="Não foi possível carregar os indicadores" />
      )}

      {isEmpty ? (
        <EmptyState
          title="Sua visão financeira começa aqui"
          description="Cadastre ou envie o primeiro documento para acompanhar valores, vencimentos e alertas reais neste painel."
          icon={ReceiptText}
          action={
            <Button asChild>
              <Link href="/app/contas-a-pagar/nova">
                Cadastrar primeira conta
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-3">
            <DashboardCard
              title="Saídas previstas"
              description="Compromissos em aberto agrupados por semana"
              className="xl:col-span-2"
            >
              {forecast.status === "fulfilled" ? (
                forecast.value.some((item) => item.totalCents > 0) ? (
                  <ForecastChart data={forecast.value} />
                ) : (
                  <PanelEmpty text="Nenhuma saída prevista nas próximas semanas." />
                )
              ) : (
                <PanelError title="O gráfico não pôde ser carregado" compact />
              )}
            </DashboardCard>
            <DashboardCard
              title="Alertas"
              description="Itens que merecem sua revisão"
            >
              {alerts.status === "fulfilled" ? (
                <AlertsList alerts={alerts.value} />
              ) : (
                <PanelError
                  title="Os alertas não puderam ser carregados"
                  compact
                />
              )}
            </DashboardCard>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <DashboardCard
              title="Por categoria"
              description="Distribuição dos valores em aberto"
            >
              {distributions.status === "fulfilled" ? (
                distributions.value.categories.length ? (
                  <DistributionChart
                    data={distributions.value.categories}
                    label="Valores em aberto por categoria"
                  />
                ) : (
                  <PanelEmpty text="Nenhuma categoria com valor em aberto." />
                )
              ) : (
                <PanelError
                  title="A distribuição não pôde ser carregada"
                  compact
                />
              )}
            </DashboardCard>
            <DashboardCard
              title="Por fornecedor"
              description="Fornecedores com maior valor em aberto"
            >
              {distributions.status === "fulfilled" ? (
                distributions.value.suppliers.length ? (
                  <DistributionChart
                    data={distributions.value.suppliers}
                    label="Valores em aberto por fornecedor"
                  />
                ) : (
                  <PanelEmpty text="Nenhum fornecedor com valor em aberto." />
                )
              ) : (
                <PanelError
                  title="A distribuição não pôde ser carregada"
                  compact
                />
              )}
            </DashboardCard>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <DashboardCard
              title="Próximas contas"
              description="Vencimentos futuros em ordem cronológica"
            >
              {upcoming.status === "fulfilled" ? (
                <AccountsList
                  items={upcoming.value.items}
                  empty="Nenhuma conta futura em aberto."
                />
              ) : (
                <PanelError
                  title="As próximas contas não puderam ser carregadas"
                  compact
                />
              )}
            </DashboardCard>
            <DashboardCard
              title="Contas vencidas"
              description="Pendências que precisam de atenção"
            >
              {overdue.status === "fulfilled" ? (
                <AccountsList
                  items={overdue.value.items}
                  empty="Nenhuma conta vencida. Tudo em dia."
                />
              ) : (
                <PanelError
                  title="As contas vencidas não puderam ser carregadas"
                  compact
                />
              )}
            </DashboardCard>
          </div>
        </>
      )}
    </section>
  );
}

function Money({ cents }: { cents: number }) {
  return <CurrencyDisplay value={moneyInCents(cents)} />;
}

function DashboardCard({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function AccountsList({
  items,
  empty,
}: {
  items: PayableListItem[];
  empty: string;
}) {
  if (!items.length) return <PanelEmpty text={empty} />;
  return (
    <ul className="divide-y" aria-label="Contas">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <Link
              href={`/app/contas-a-pagar/${item.id}`}
              className="font-medium hover:underline"
            >
              {item.description}
            </Link>
            <p className="text-muted-foreground mt-1 text-xs">
              {item.supplierName ?? "Sem fornecedor"} ·{" "}
              <DateDisplay value={businessDate(item.due_date)} />
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
            <StatusBadge status={item.status} />
            <Money cents={item.amount_cents} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function AlertsList({
  alerts,
}: {
  alerts: {
    possibleDuplicates: number;
    documentsNeedsReview: number;
    documentsFailed: number;
  };
}) {
  const items = [
    { label: "Possíveis duplicidades", count: alerts.possibleDuplicates },
    {
      label: "Documentos aguardando revisão",
      count: alerts.documentsNeedsReview,
    },
    { label: "Falhas na leitura de documentos", count: alerts.documentsFailed },
  ];
  if (!items.some((item) => item.count > 0))
    return <PanelEmpty text="Nenhum alerta pendente no momento." />;
  return (
    <ul className="space-y-2">
      {items
        .filter((item) => item.count > 0)
        .map((item) => (
          <li key={item.label}>
            <Link
              href="/app/contas-a-pagar"
              className="bg-muted/50 hover:bg-muted flex items-center justify-between rounded-lg p-3"
            >
              <span className="flex items-center gap-2">
                <FileSearch className="size-4" aria-hidden="true" />
                {item.label}
              </span>
              <span className="font-mono font-semibold">{item.count}</span>
            </Link>
          </li>
        ))}
    </ul>
  );
}

function PanelEmpty({ text }: { text: string }) {
  return (
    <p className="text-muted-foreground grid min-h-32 place-items-center rounded-lg border border-dashed p-6 text-center text-sm">
      {text}
    </p>
  );
}

function PanelError({
  title,
  compact = false,
}: {
  title: string;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={`border-destructive/25 bg-destructive/5 text-destructive flex items-center gap-3 rounded-lg border p-4 ${compact ? "min-h-24" : ""}`}
    >
      <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
      <p className="text-sm font-medium">
        {title}. Atualize a página para tentar novamente.
      </p>
    </div>
  );
}
