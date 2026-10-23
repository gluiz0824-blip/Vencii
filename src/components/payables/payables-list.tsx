"use client";

import { Copy, Eye, MoreHorizontal, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { duplicateAccountPayableAction } from "@/app/actions/accounts-payable";
import { CurrencyDisplay } from "@/components/product/currency-display";
import { DateDisplay } from "@/components/product/date-display";
import { StatusBadge } from "@/components/product/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PAYABLE_SOURCE_LABELS,
  canEditFinancialFields,
} from "@/domain/payables/payable";
import { businessDate } from "@/domain/shared/business-date";
import { moneyInCents } from "@/domain/shared/money";
import type { PayableListItem } from "@/repositories/accounts-payable-server.repository";

interface PayablesListProps {
  items: PayableListItem[];
  canWrite: boolean;
}

export function PayablesList({ items, canWrite }: PayablesListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = items.length > 0 && selected.size === items.length;

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="bg-secondary flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm">
          <span>
            {selected.size}{" "}
            {selected.size === 1 ? "conta selecionada" : "contas selecionadas"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
          >
            <X /> Limpar seleção
          </Button>
        </div>
      )}

      <div className="bg-card shadow-card hidden overflow-hidden rounded-xl border md:block">
        <Table>
          <caption className="sr-only">
            Contas a pagar da organização ativa
          </caption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    allSelected
                      ? true
                      : selected.size > 0
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(checked) =>
                    setSelected(
                      checked === true
                        ? new Set(items.map(({ id }) => id))
                        : new Set(),
                    )
                  }
                  aria-label="Selecionar todas as contas desta página"
                />
              </TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="text-end">Valor</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.id}
                data-state={selected.has(item.id) ? "selected" : undefined}
              >
                <TableCell>
                  <Checkbox
                    checked={selected.has(item.id)}
                    onCheckedChange={(checked) =>
                      toggle(item.id, checked === true)
                    }
                    aria-label={`Selecionar ${item.description}`}
                  />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/app/contas-a-pagar/${item.id}`}
                    className="font-medium hover:underline"
                  >
                    {item.description}
                  </Link>
                  {item.installment_number && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Parcela {item.installment_number}/{item.installment_total}
                    </p>
                  )}
                </TableCell>
                <TableCell>{item.supplierName ?? "—"}</TableCell>
                <TableCell>
                  <DateDisplay value={businessDate(item.due_date)} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {PAYABLE_SOURCE_LABELS[item.source]}
                </TableCell>
                <TableCell className="text-end">
                  <CurrencyDisplay value={moneyInCents(item.amount_cents)} />
                </TableCell>
                <TableCell>
                  <RowActions item={item} canWrite={canWrite} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {items.map((item) => (
          <Card key={item.id} size="sm">
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  className="mt-1"
                  checked={selected.has(item.id)}
                  onCheckedChange={(checked) =>
                    toggle(item.id, checked === true)
                  }
                  aria-label={`Selecionar ${item.description}`}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/app/contas-a-pagar/${item.id}`}
                    className="font-medium hover:underline"
                  >
                    {item.description}
                  </Link>
                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    {item.supplierName ?? "Sem fornecedor"}
                  </p>
                </div>
                <RowActions item={item} canWrite={canWrite} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <StatusBadge status={item.status} />
                <CurrencyDisplay
                  value={moneyInCents(item.amount_cents)}
                  className="font-semibold"
                />
              </div>
              <div className="text-muted-foreground flex items-center justify-between gap-3 border-t pt-3 text-xs">
                <span>
                  Vence em <DateDisplay value={businessDate(item.due_date)} />
                </span>
                <span>{PAYABLE_SOURCE_LABELS[item.source]}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RowActions({
  item,
  canWrite,
}: {
  item: PayableListItem;
  canWrite: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Ações para ${item.description}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link href={`/app/contas-a-pagar/${item.id}`}>
            <Eye /> Ver detalhes
          </Link>
        </DropdownMenuItem>
        {canWrite && canEditFinancialFields(item.status) && (
          <DropdownMenuItem asChild>
            <Link href={`/app/contas-a-pagar/${item.id}/editar`}>
              <Pencil /> Editar
            </Link>
          </DropdownMenuItem>
        )}
        {canWrite && (
          <>
            <DropdownMenuSeparator />
            <form action={duplicateAccountPayableAction.bind(null, item.id)}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <Copy /> Duplicar
                </button>
              </DropdownMenuItem>
            </form>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
