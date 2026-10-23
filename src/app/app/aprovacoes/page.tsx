import {
  Bell,
  CheckCheck,
  CircleDollarSign,
  ClockAlert,
  Search,
  Settings2,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ApprovalInbox } from "@/components/approvals/approval-inbox";
import { EmptyState } from "@/components/product/empty-state";
import { MetricCard } from "@/components/product/metric-card";
import { PageHeader } from "@/components/product/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspace } from "@/dal/workspace";
import { moneyInCents } from "@/domain/shared/money";
import { todayInTimeZone } from "@/domain/shared/timezone";
import { listPayableLookups } from "@/repositories/accounts-payable-server.repository";
import {
  createDueApprovalNotifications,
  listApprovalInbox,
  listNotifications,
} from "@/repositories/approval-server.repository";
import { parseBrlAmountToCents } from "@/validation/payable";

export const metadata: Metadata = { title: "Aprovações" };

type SearchParams = Record<string, string | string[] | undefined>;
const allowedRoles = ["owner", "admin", "approver"];
const urgencies = ["overdue", "today", "next_7_days"];

function value(params: SearchParams, key: string) {
  const item = params[key];
  return typeof item === "string" ? item : "";
}

function optionalCents(raw: string) {
  if (!raw) return undefined;
  try {
    return parseBrlAmountToCents(raw.includes(",") ? raw : `${raw},00`);
  } catch {
    return undefined;
  }
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [workspace, params] = await Promise.all([
    requireWorkspace(),
    searchParams,
  ]);
  const organization = workspace.activeOrganization;
  const canApprove = allowedRoles.includes(organization.role);

  if (!canApprove) {
    return (
      <section className="app-page space-y-[var(--space-section)]">
        <PageHeader
          title="Aprovações"
          description="Decisões financeiras separadas da operação diária."
          breadcrumbs={[{ label: "Aprovações" }]}
        />
        <EmptyState
          title="Acesso restrito a aprovadores"
          description="Seu papel atual não permite aprovar ou rejeitar contas. A proteção também é aplicada no banco de dados."
          icon={CheckCheck}
        />
      </section>
    );
  }

  const today = todayInTimeZone(organization.timezone);
  await createDueApprovalNotifications(organization.id, today).catch(
    () => undefined,
  );
  const urgency = urgencies.includes(value(params, "urgency"))
    ? value(params, "urgency")
    : undefined;
  const [items, lookups, notifications] = await Promise.all([
    listApprovalInbox({
      organizationId: organization.id,
      businessDate: today,
      urgency,
      dueFrom: value(params, "dueFrom") || undefined,
      dueTo: value(params, "dueTo") || undefined,
      minAmountCents: optionalCents(value(params, "minAmount")),
      maxAmountCents: optionalCents(value(params, "maxAmount")),
      supplierId: value(params, "supplierId") || undefined,
    }),
    listPayableLookups(organization.id),
    listNotifications(organization.id),
  ]);
  const totalCents = items.reduce((sum, item) => sum + item.amountCents, 0);
  const urgentCount = items.filter((item) => item.dueDate <= today).length;

  return (
    <section className="app-page space-y-[var(--space-section)]">
      <PageHeader
        title="Minhas aprovações"
        description="Revise os dados completos antes de aprovar ou rejeitar uma conta. Toda decisão fica auditada."
        breadcrumbs={[{ label: "Aprovações" }]}
        actions={
          organization.role === "owner" || organization.role === "admin" ? (
            <Button asChild variant="outline">
              <Link href="/app/configuracoes/aprovacoes">
                <Settings2 /> Configurar regras
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Aguardando decisão"
          value={String(items.length)}
          helper="Considerando os filtros atuais"
          icon={CheckCheck}
        />
        <MetricCard
          label="Valor em análise"
          value={new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(moneyInCents(totalCents) / 100)}
          helper="Soma calculada no resultado autorizado"
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Urgentes"
          value={String(urgentCount)}
          helper="Vencidas ou com vencimento hoje"
          icon={ClockAlert}
        />
      </div>

      <Card>
        <CardContent>
          <form
            method="get"
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
          >
            <FilterSelect
              name="urgency"
              label="Todas as urgências"
              defaultValue={urgency ?? ""}
            >
              <option value="overdue">Vencidas</option>
              <option value="today">Vencem hoje</option>
              <option value="next_7_days">Próximos 7 dias</option>
            </FilterSelect>
            <FilterSelect
              name="supplierId"
              label="Todos os fornecedores"
              defaultValue={value(params, "supplierId")}
            >
              {lookups.suppliers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </FilterSelect>
            <input
              className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
              name="dueFrom"
              type="date"
              defaultValue={value(params, "dueFrom")}
              aria-label="Vencimento inicial"
            />
            <input
              className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
              name="dueTo"
              type="date"
              defaultValue={value(params, "dueTo")}
              aria-label="Vencimento final"
            />
            <input
              className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
              name="minAmount"
              defaultValue={value(params, "minAmount")}
              placeholder="Valor mínimo"
              aria-label="Valor mínimo"
            />
            <input
              className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
              name="maxAmount"
              defaultValue={value(params, "maxAmount")}
              placeholder="Valor máximo"
              aria-label="Valor máximo"
            />
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit">
                <Search /> Aplicar filtros
              </Button>
              <Button asChild variant="outline">
                <Link href="/app/aprovacoes">Limpar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {items.length ? (
        <ApprovalInbox items={items} today={today} />
      ) : (
        <EmptyState
          title="Nenhuma decisão pendente"
          description="Não existem solicitações compatíveis com os filtros selecionados."
          icon={CheckCheck}
        />
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4" /> Notificações internas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length ? (
            <ul className="divide-y">
              {notifications.map((item) => (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 size-2 rounded-full ${item.readAt ? "bg-muted-foreground/30" : "bg-primary"}`}
                      aria-label={item.readAt ? "Lida" : "Não lida"}
                    />
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {item.body}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nenhuma notificação recente.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function FilterSelect({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      aria-label={label}
      className="border-input bg-background focus-visible:ring-ring/50 h-8 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
    >
      <option value="">{label}</option>
      {children}
    </select>
  );
}
