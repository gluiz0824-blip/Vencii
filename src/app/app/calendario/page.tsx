import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getISODay,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  Search,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CurrencyDisplay } from "@/components/product/currency-display";
import { DateDisplay } from "@/components/product/date-display";
import { EmptyState } from "@/components/product/empty-state";
import { PageHeader } from "@/components/product/page-header";
import { StatusBadge } from "@/components/product/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspace } from "@/dal/workspace";
import { PAYABLE_STATUS_LABELS } from "@/domain/payables/payable";
import { businessDate } from "@/domain/shared/business-date";
import { moneyInCents } from "@/domain/shared/money";
import { todayInTimeZone } from "@/domain/shared/timezone";
import { listPayableLookups } from "@/repositories/accounts-payable-server.repository";
import {
  getPayablesCalendar,
  type CalendarAccount,
  type CalendarDay,
} from "@/repositories/financial-dashboard-server.repository";
import type { PayableStatus } from "@/types/database";

export const metadata: Metadata = { title: "Calendário" };

type SearchParams = Record<string, string | string[] | undefined>;
const calendarStatuses = [
  "draft",
  "pending",
  "awaiting_approval",
  "approved",
  "scheduled",
  "partial",
  "paid",
  "overdue",
] as const satisfies readonly PayableStatus[];
const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function param(params: SearchParams, name: string) {
  const value = params[name];
  return typeof value === "string" ? value : "";
}

function validMonth(value: string, fallback: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : fallback;
}

function calendarHref(
  params: SearchParams,
  changes: Record<string, string | undefined>,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (typeof value === "string" && value) query.set(key, value);
  for (const [key, value] of Object.entries(changes)) {
    if (value) query.set(key, value);
    else query.delete(key);
  }
  return `/app/calendario?${query.toString()}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [workspace, params] = await Promise.all([
    requireWorkspace(),
    searchParams,
  ]);
  const organizationId = workspace.activeOrganization.id;
  const today = todayInTimeZone(workspace.activeOrganization.timezone);
  const month = validMonth(param(params, "month"), today.slice(0, 7));
  const monthDate = parseISO(`${month}-01`);
  const dateFrom = format(startOfMonth(monthDate), "yyyy-MM-dd");
  const dateTo = format(endOfMonth(monthDate), "yyyy-MM-dd");
  const rawStatus = param(params, "status");
  const status = calendarStatuses.includes(
    rawStatus as (typeof calendarStatuses)[number],
  )
    ? (rawStatus as PayableStatus)
    : undefined;
  const view = param(params, "view") === "agenda" ? "agenda" : "month";

  const lookups = await listPayableLookups(organizationId);
  const supplierId = lookups.suppliers.some(
    (item) => item.id === param(params, "supplierId"),
  )
    ? param(params, "supplierId")
    : undefined;
  const categoryId = lookups.categories.some(
    (item) => item.id === param(params, "categoryId"),
  )
    ? param(params, "categoryId")
    : undefined;

  let calendar: CalendarDay[] | null = null;
  try {
    calendar = await getPayablesCalendar({
      organizationId,
      dateFrom,
      dateTo,
      status,
      supplierId,
      categoryId,
    });
  } catch {
    calendar = null;
  }

  const selectedDate = param(params, "day");
  const selected = calendar?.find((day) => day.dueDate === selectedDate);
  const dayMap = new Map((calendar ?? []).map((day) => [day.dueDate, day]));
  const days = eachDayOfInterval({
    start: startOfMonth(monthDate),
    end: endOfMonth(monthDate),
  });
  const leading = Array.from({ length: getISODay(days[0]!) - 1 });

  return (
    <section className="app-page space-y-[var(--space-section)]">
      <PageHeader
        title="Calendário"
        description={`Vencimentos de ${workspace.activeOrganization.tradeName}, respeitando o fuso ${workspace.activeOrganization.timezone}.`}
        breadcrumbs={[{ label: "Calendário" }]}
      />

      <Card>
        <CardContent>
          <form
            method="get"
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"
          >
            <input type="hidden" name="month" value={month} />
            <input type="hidden" name="view" value={view} />
            <FilterSelect
              name="status"
              label="Todos os status"
              defaultValue={status ?? ""}
            >
              {calendarStatuses.map((item) => (
                <option key={item} value={item}>
                  {PAYABLE_STATUS_LABELS[item]}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              name="supplierId"
              label="Todos os fornecedores"
              defaultValue={supplierId ?? ""}
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
              defaultValue={categoryId ?? ""}
            >
              {lookups.categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </FilterSelect>
            <Button type="submit">
              <Search /> Aplicar filtros
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/app/calendario?month=${month}`}>Limpar</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link
              aria-label="Mês anterior"
              href={calendarHref(params, {
                month: format(subMonths(monthDate, 1), "yyyy-MM"),
                day: undefined,
              })}
            >
              <ChevronLeft />
            </Link>
          </Button>
          <h2 className="min-w-44 text-center text-lg font-semibold capitalize">
            {format(monthDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
          <Button variant="outline" size="icon" asChild>
            <Link
              aria-label="Próximo mês"
              href={calendarHref(params, {
                month: format(addMonths(monthDate, 1), "yyyy-MM"),
                day: undefined,
              })}
            >
              <ChevronRight />
            </Link>
          </Button>
        </div>
        <div
          className="flex rounded-lg border p-1"
          aria-label="Modo de visualização"
        >
          <Button
            size="sm"
            variant={view === "month" ? "secondary" : "ghost"}
            asChild
          >
            <Link href={calendarHref(params, { view: "month" })}>
              <CalendarDays /> Mensal
            </Link>
          </Button>
          <Button
            size="sm"
            variant={view === "agenda" ? "secondary" : "ghost"}
            asChild
          >
            <Link href={calendarHref(params, { view: "agenda" })}>
              <List /> Agenda
            </Link>
          </Button>
        </div>
      </div>

      {calendar === null ? (
        <div
          role="alert"
          className="border-destructive/25 bg-destructive/5 text-destructive rounded-xl border p-6 text-sm font-medium"
        >
          Não foi possível carregar o calendário. Atualize a página para tentar
          novamente.
        </div>
      ) : calendar.length === 0 ? (
        <EmptyState
          title="O calendário está livre neste período"
          description="Nenhum vencimento real corresponde ao mês e aos filtros selecionados."
          icon={CalendarDays}
          action={
            <Button asChild>
              <Link href="/app/contas-a-pagar/nova">Cadastrar conta</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Card
            className={`${view === "agenda" ? "hidden" : "hidden md:flex"}`}
          >
            <CardContent>
              <div className="grid grid-cols-7 border-b pb-2" role="row">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="text-muted-foreground px-2 text-center text-xs font-medium"
                    role="columnheader"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div
                className="grid grid-cols-7"
                role="grid"
                aria-label={`Calendário de ${format(monthDate, "MMMM 'de' yyyy", { locale: ptBR })}`}
              >
                {leading.map((_, index) => (
                  <div
                    key={`empty-${index}`}
                    className="bg-muted/20 min-h-32 border-r border-b"
                    aria-hidden="true"
                  />
                ))}
                {days.map((date) => (
                  <CalendarCell
                    key={date.toISOString()}
                    date={date}
                    data={dayMap.get(format(date, "yyyy-MM-dd"))}
                    params={params}
                    selected={selectedDate === format(date, "yyyy-MM-dd")}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <div className={view === "agenda" ? "block" : "block md:hidden"}>
            <Agenda days={calendar} />
          </div>

          {selected && view === "month" && <SelectedDay day={selected} />}
        </>
      )}
    </section>
  );
}

function CalendarCell({
  date,
  data,
  params,
  selected,
}: {
  date: Date;
  data?: CalendarDay;
  params: SearchParams;
  selected: boolean;
}) {
  const iso = format(date, "yyyy-MM-dd");
  return (
    <div
      role="gridcell"
      className={`min-h-32 border-r border-b p-2 ${selected ? "bg-primary/5 ring-primary ring-2 ring-inset" : ""}`}
    >
      <Link
        href={calendarHref(params, { day: iso })}
        className="focus-visible:ring-ring inline-flex size-7 items-center justify-center rounded-md text-sm font-medium outline-none focus-visible:ring-2"
        aria-label={`Abrir vencimentos de ${format(date, "dd/MM/yyyy")}`}
      >
        {format(date, "d")}
      </Link>
      {data && (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-semibold">
            {data.accountCount} {data.accountCount === 1 ? "conta" : "contas"}
          </p>
          <CurrencyDisplay
            value={moneyInCents(data.totalCents)}
            className="text-xs"
          />
          {data.accounts.slice(0, 2).map((account) => (
            <Link
              key={account.id}
              href={`/app/contas-a-pagar/${account.id}`}
              className="bg-muted block truncate rounded px-1.5 py-1 text-[11px] hover:underline"
            >
              {account.description}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Agenda({ days }: { days: CalendarDay[] }) {
  return (
    <div className="space-y-4">
      {days.map((day) => (
        <Card key={day.dueDate}>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>
                <DateDisplay value={businessDate(day.dueDate)} />
              </CardTitle>
              <p className="text-muted-foreground mt-1 text-xs">
                {day.accountCount} {day.accountCount === 1 ? "conta" : "contas"}
              </p>
            </div>
            <CurrencyDisplay
              value={moneyInCents(day.totalCents)}
              className="font-semibold"
            />
          </CardHeader>
          <CardContent>
            <AccountRows accounts={day.accounts} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SelectedDay({ day }: { day: CalendarDay }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Vencimentos de <DateDisplay value={businessDate(day.dueDate)} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <AccountRows accounts={day.accounts} />
      </CardContent>
    </Card>
  );
}

function AccountRows({ accounts }: { accounts: CalendarAccount[] }) {
  return (
    <ul className="divide-y">
      {accounts.map((account) => (
        <li
          key={account.id}
          className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <Link
              href={`/app/contas-a-pagar/${account.id}`}
              className="font-medium hover:underline"
            >
              {account.description}
            </Link>
            <p className="text-muted-foreground mt-1 text-xs">
              {account.supplierName ?? "Sem fornecedor"}
              {account.categoryName ? ` · ${account.categoryName}` : ""}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <StatusBadge status={account.status} />
            <CurrencyDisplay value={moneyInCents(account.amountCents)} />
          </div>
        </li>
      ))}
    </ul>
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
