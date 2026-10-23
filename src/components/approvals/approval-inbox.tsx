"use client";

import { useActionState, useState } from "react";
import { Check, ExternalLink, ShieldAlert, X } from "lucide-react";
import Link from "next/link";

import {
  approvePayableRequestsBatchAction,
  decidePayableApprovalAction,
  type ApprovalActionState,
} from "@/app/actions/approvals";
import { CurrencyDisplay } from "@/components/product/currency-display";
import { DateDisplay } from "@/components/product/date-display";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PAYABLE_DOCUMENT_LABELS } from "@/domain/payables/payable";
import { businessDate } from "@/domain/shared/business-date";
import { moneyInCents } from "@/domain/shared/money";
import type { ApprovalInboxItem } from "@/repositories/approval-server.repository";

const initialState: ApprovalActionState = { status: "idle" };

export function ApprovalInbox({
  items,
  today,
}: {
  items: ApprovalInboxItem[];
  today: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const eligibleIds = items
    .filter((item) => item.canDecide)
    .map((item) => item.requestId);
  const allSelected =
    eligibleIds.length > 0 && eligibleIds.every((id) => selected.includes(id));

  function toggle(id: string, checked: boolean) {
    setSelected((current) =>
      checked
        ? [...new Set([...current, id])]
        : current.filter((item) => item !== id),
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-3 text-sm font-medium">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) =>
              setSelected(checked === true ? eligibleIds : [])
            }
            aria-label="Selecionar todas as aprovações disponíveis"
          />
          Selecionar disponíveis
        </label>
        <BatchApproval selected={selected} />
      </div>

      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.requestId}>
            <Card>
              <CardContent className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
                <Checkbox
                  checked={selected.includes(item.requestId)}
                  onCheckedChange={(checked) =>
                    toggle(item.requestId, checked === true)
                  }
                  disabled={!item.canDecide}
                  aria-label={`Selecionar ${item.description}`}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/app/contas-a-pagar/${item.accountId}`}
                      className="text-base font-semibold hover:underline"
                    >
                      {item.description}
                    </Link>
                    <UrgencyBadge dueDate={item.dueDate} today={today} />
                    {!item.canDecide && (
                      <Badge variant="outline">
                        <ShieldAlert /> Autoaprovação bloqueada
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                    <span>
                      Fornecedor: {item.supplierName ?? "Não informado"}
                    </span>
                    <span>
                      Vencimento:{" "}
                      <DateDisplay value={businessDate(item.dueDate)} />
                    </span>
                    <span>
                      Documento: {PAYABLE_DOCUMENT_LABELS[item.documentType]}
                      {item.documentNumber ? ` · ${item.documentNumber}` : ""}
                    </span>
                    <span>
                      Progresso: {item.approvalCount}/{item.requiredApprovals}{" "}
                      aprovações
                    </span>
                  </div>
                  {item.barcode && (
                    <p className="text-muted-foreground mt-2 truncate font-mono text-[11px]">
                      Linha digitável: {item.barcode}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <CurrencyDisplay
                    value={moneyInCents(item.amountCents)}
                    className="me-2 text-base font-semibold"
                  />
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/contas-a-pagar/${item.accountId}`}>
                      <ExternalLink /> Detalhes
                    </Link>
                  </Button>
                  {item.canDecide && (
                    <DecisionDialogs requestId={item.requestId} />
                  )}
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UrgencyBadge({ dueDate, today }: { dueDate: string; today: string }) {
  if (dueDate < today) return <Badge variant="destructive">Vencida</Badge>;
  if (dueDate === today)
    return (
      <Badge variant="outline">
        <ShieldAlert /> Vence hoje
      </Badge>
    );
  return null;
}

function DecisionDialogs({ requestId }: { requestId: string }) {
  return (
    <>
      <DecisionDialog requestId={requestId} decision="approved" />
      <DecisionDialog requestId={requestId} decision="rejected" />
    </>
  );
}

function DecisionDialog({
  requestId,
  decision,
}: {
  requestId: string;
  decision: "approved" | "rejected";
}) {
  const action = decidePayableApprovalAction.bind(null, requestId, decision);
  const [state, formAction, pending] = useActionState(action, initialState);
  const approve = decision === "approved";
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={approve ? "default" : "destructive"}>
          {approve ? <Check /> : <X />}
          {approve ? "Aprovar" : "Rejeitar"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {approve ? "Aprovar esta conta?" : "Rejeitar esta conta?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {approve
                ? "Sua decisão será auditada e poderá completar a solicitação."
                : "A conta será rejeitada e a justificativa ficará no histórico."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 space-y-2">
            <Label htmlFor={`comment-${requestId}-${decision}`}>
              {approve ? "Comentário (opcional)" : "Justificativa"}
            </Label>
            <Textarea
              id={`comment-${requestId}-${decision}`}
              name="comment"
              required={!approve}
              minLength={approve ? undefined : 3}
              maxLength={1000}
            />
            {state.message && (
              <p
                role="status"
                className={
                  state.status === "error"
                    ? "text-destructive text-sm"
                    : "text-status-paid-foreground text-sm"
                }
              >
                {state.message}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              disabled={pending}
              className={
                approve
                  ? ""
                  : "bg-destructive hover:bg-destructive/90 text-white"
              }
            >
              {pending
                ? "Registrando..."
                : approve
                  ? "Confirmar aprovação"
                  : "Confirmar rejeição"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BatchApproval({ selected }: { selected: string[] }) {
  const [state, formAction, pending] = useActionState(
    approvePayableRequestsBatchAction,
    initialState,
  );
  return (
    <div className="flex flex-wrap items-center gap-3">
      {state.message && (
        <p
          role="status"
          className={
            state.status === "error"
              ? "text-destructive text-sm"
              : "text-status-paid-foreground text-sm"
          }
        >
          {state.message}
        </p>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={!selected.length}>
            <Check /> Aprovar em lote ({selected.length})
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <form action={formAction}>
            {selected.map((id) => (
              <input key={id} type="hidden" name="requestIds" value={id} />
            ))}
            <AlertDialogHeader>
              <AlertDialogTitle>
                Aprovar {selected.length} solicitações?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Todas serão processadas na mesma transação. Se uma não puder ser
                aprovada, nenhuma decisão do lote será salva.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="my-4 space-y-2">
              <Label htmlFor="batch-comment">
                Comentário do lote (opcional)
              </Label>
              <Textarea id="batch-comment" name="comment" maxLength={1000} />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction type="submit" disabled={pending}>
                {pending ? "Aprovando..." : "Confirmar lote"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
