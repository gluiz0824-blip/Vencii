import { CircleDollarSign, Plus, ReceiptText, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DocumentUpload } from "@/components/attachments/document-upload";
import { EmptyState } from "@/components/product/empty-state";
import { MetricCard } from "@/components/product/metric-card";
import { PageHeader } from "@/components/product/page-header";
import { PayablesList } from "@/components/payables/payables-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  PAYABLE_STATUS_LABELS,
  PAYABLE_WRITE_ROLES,
} from "@/domain/payables/payable";
import { moneyInCents } from "@/domain/shared/money";
import { todayInTimeZone } from "@/domain/shared/timezone";
import { requireWorkspace } from "@/dal/workspace";
import {
  listAccountsPayable,
  listPayableLookups,
  markOrganizationAccountsOverdue,
} from "@/repositories/accounts-payable-server.repository";
import type { PayableSource, PayableStatus } from "@/types/database";
import { parseBrlAmountToCents } from "@/validation/payable";

export const metadata: Metadata = { title: "Contas a pagar" };

type SearchParams = Record<string, string | string[] | undefined>;

const statuses = Object.keys(PAYABLE_STATUS_LABELS) as PayableStatus[];
const sources: { value: PayableSource; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "upload", label: "Upload" },
  { value: "email", label: "E-mail" },
  { value: "import", label: "Importação" },
];

function value(params: SearchParams, key: string): string {
  const item = params[key];
  return typeof item === "string" ? item : "";
}

function optionalCents(raw: string): number | undefined {
  if (!raw) return undefined;
  try {
    return parseBrlAmountToCents(raw.includes(",") ? raw : `${raw},00`);
  } catch {
    return undefined;
  }
}

function pageHref(params: SearchParams, page: number): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, item]) => {
    if (typeof item === "string" && key !== "page" && item)
      query.set(key, item);
  });
  query.set("page", String(page));
  return `/app/contas-a-pagar?${query.toString()}`;
}

export default async function PayablesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [workspace, params] = await Promise.all([
    requireWorkspace(),
    searchParams,
  ]);
  const organizationId = workspace.activeOrganization.id;
  await markOrganizationAccountsOverdue(
    organizationId,
    todayInTimeZone(workspace.activeOrganization.timezone),
  );

  const page = Math.max(
    1,
    Number.parseInt(value(params, "page") || "1", 10) || 1,
  );
  const status = value(params, "status");
  const source = value(params, "source");
  const [result, lookups] = await Promise.all([
    listAccountsPayable(organizationId, {
      query: value(params, "q"),
      dueFrom: value(params, "dueFrom"),
      dueTo: value(params, "dueTo"),
      statuses: statuses.includes(status as PayableStatus)
        ? [status as PayableStatus]
        : undefined,
      supplierId: value(params, "supplierId"),
      categoryId: value(params, "categoryId"),
      source: sources.some(({ value: item }) => item === source)
        ? (source as PayableSource)
        : undefined,
      minAmountCents: optionalCents(value(params, "minAmount")),
      maxAmountCents: optionalCents(value(params, "maxAmount")),
      sort: (
        [
          "due_date",
          "amount_cents",
          "description",
          "status",
          "created_at",
        ] as const
      ).find((item) => item === value(params, "sort")),
      direction: value(params, "direction") === "asc" ? "asc" : "desc",
      page,
      pageSize: 20,
    }),
    listPayableLookups(organizationId),
  ]);
  const canWrite = (PAYABLE_WRITE_ROLES as readonly string[]).includes(
    workspace.activeOrganization.role,
  );
  const pageTotal = result.items.reduce(
    (sum, item) => sum + item.amount_cents,
    0,
  );
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <section className="app-page space-y-[var(--space-section)]">
      <PageHeader
        title="Contas a pagar"
        description="Organize obrigações, vencimentos, parcelas e recorrências sem executar transações bancárias."
        breadcrumbs={[{ label: "Contas a pagar" }]}
        actions={
          canWrite ? (
            <Button asChild>
              <Link href="/app/contas-a-pagar/nova">
                <Plus /> Nova conta
              </Link>
            </Button>
          ) : undefined
        }
      />

      {canWrite && <DocumentUpload />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Contas encontradas"
          value={String(result.total)}
          helper="Considerando todos os filtros aplicados"
          icon={ReceiptText}
        />
        <MetricCard
          label="Valor nesta página"
          value={
            <span>
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(moneyInCents(pageTotal) / 100)}
            </span>
          }
          helper="Até 20 contas por página"
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Página atual"
          value={`${Math.min(page, pageCount)} de ${pageCount}`}
          helper="Paginação processada no servidor"
          icon={Search}
        />
      </div>

      <Card>
        <CardContent>
          <form
            method="get"
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
          >
            <div className="relative md:col-span-2">
              <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                name="q"
                defaultValue={value(params, "q")}
                placeholder="Descrição, fornecedor, documento ou linha digitável"
                aria-label="Buscar contas"
                className="w-full ps-9"
              />
            </div>
            <FilterSelect
              name="status"
              label="Todos os status"
              defaultValue={status}
            >
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {PAYABLE_STATUS_LABELS[item]}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              name="source"
              label="Todas as origens"
              defaultValue={source}
            >
              {sources.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </FilterSelect>
            <Input
              name="dueFrom"
              type="date"
              defaultValue={value(params, "dueFrom")}
              aria-label="Vencimento inicial"
            />
            <Input
              name="dueTo"
              type="date"
              defaultValue={value(params, "dueTo")}
              aria-label="Vencimento final"
            />
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
            <FilterSelect
              name="categoryId"
              label="Todas as categorias"
              defaultValue={value(params, "categoryId")}
            >
              {lookups.categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </FilterSelect>
            <Input
              name="minAmount"
              defaultValue={value(params, "minAmount")}
              placeholder="Valor mínimo (ex.: 100,00)"
              aria-label="Valor mínimo"
            />
            <Input
              name="maxAmount"
              defaultValue={value(params, "maxAmount")}
              placeholder="Valor máximo (ex.: 500,00)"
              aria-label="Valor máximo"
            />
            <FilterSelect
              name="sort"
              label="Ordenar por vencimento"
              defaultValue={value(params, "sort")}
            >
              <option value="amount_cents">Ordenar por valor</option>
              <option value="description">Ordenar por descrição</option>
              <option value="status">Ordenar por status</option>
              <option value="created_at">Ordenar por cadastro</option>
            </FilterSelect>
            <FilterSelect
              name="direction"
              label="Mais recentes primeiro"
              defaultValue={value(params, "direction")}
            >
              <option value="asc">Crescente</option>
              <option value="desc">Decrescente</option>
            </FilterSelect>
            <div className="flex gap-2 md:col-span-2 xl:col-span-4">
              <Button type="submit">
                <Search /> Aplicar filtros
              </Button>
              <Button asChild variant="outline">
                <Link href="/app/contas-a-pagar">Limpar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result.items.length > 0 ? (
        <>
          <PayablesList items={result.items} canWrite={canWrite} />
          <nav
            className="flex items-center justify-between gap-4"
            aria-label="Paginação de contas"
          >
            <p className="text-muted-foreground text-xs">
              {result.total} resultados · página {page} de {pageCount}
            </p>
            <div className="flex gap-2">
              <Button asChild={page > 1} variant="outline" disabled={page <= 1}>
                {page > 1 ? (
                  <Link href={pageHref(params, page - 1)}>Anterior</Link>
                ) : (
                  <span>Anterior</span>
                )}
              </Button>
              <Button
                asChild={page < pageCount}
                variant="outline"
                disabled={page >= pageCount}
              >
                {page < pageCount ? (
                  <Link href={pageHref(params, page + 1)}>Próxima</Link>
                ) : (
                  <span>Próxima</span>
                )}
              </Button>
            </div>
          </nav>
        </>
      ) : (
        <EmptyState
          title="Nenhuma conta encontrada"
          description="Cadastre a primeira conta ou ajuste os filtros. Nenhum dado fictício é exibido."
          icon={ReceiptText}
          action={
            canWrite ? (
              <Button asChild>
                <Link href="/app/contas-a-pagar/nova">
                  <Plus /> Nova conta
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}
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
      className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
    >
      <option value="">{label}</option>
      {children}
    </select>
  );
}
