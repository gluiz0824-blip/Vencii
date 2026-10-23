import { FileArchive, FileCheck2, Paperclip, ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PayableDetailActions } from "@/components/payables/payable-detail-actions";
import { PaymentReversalDialog } from "@/components/payments/payment-reversal-dialog";
import { CurrencyDisplay } from "@/components/product/currency-display";
import { DateDisplay } from "@/components/product/date-display";
import { PageHeader } from "@/components/product/page-header";
import { StatusBadge } from "@/components/product/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PAYABLE_DOCUMENT_LABELS,
  PAYABLE_SOURCE_LABELS,
  PAYABLE_WRITE_ROLES,
  canRegisterPayment,
} from "@/domain/payables/payable";
import { businessDate } from "@/domain/shared/business-date";
import { moneyInCents } from "@/domain/shared/money";
import { requireWorkspace } from "@/dal/workspace";
import {
  findAccountPayable,
  listAccountAudit,
  listRelatedAccounts,
} from "@/repositories/accounts-payable-server.repository";
import { listAccountApprovalHistory } from "@/repositories/approval-server.repository";
import { listAccountAttachments } from "@/repositories/attachment-server.repository";
import { listAccountPayments } from "@/repositories/payment-server.repository";
import type { PaymentMethod } from "@/types/database";

export const metadata: Metadata = { title: "Detalhes da conta" };

export default async function PayableDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query, workspace] = await Promise.all([
    params,
    searchParams,
    requireWorkspace(),
  ]);
  const account = await findAccountPayable(workspace.activeOrganization.id, id);
  if (!account) notFound();
  const [related, audit, approvalHistory, attachments, paymentSummary] =
    await Promise.all([
      listRelatedAccounts(
        workspace.activeOrganization.id,
        account.recurrence_group_id,
      ),
      listAccountAudit(workspace.activeOrganization.id, account.id),
      listAccountApprovalHistory(workspace.activeOrganization.id, account.id),
      listAccountAttachments(workspace.activeOrganization.id, account.id),
      listAccountPayments(workspace.activeOrganization.id, account.id),
    ]);
  const canWrite = (PAYABLE_WRITE_ROLES as readonly string[]).includes(
    workspace.activeOrganization.role,
  );
  const successMessage =
    typeof query.created === "string"
      ? `${query.created} ${query.created === "1" ? "conta criada" : "contas criadas"} com sucesso.`
      : query.updated === "1"
        ? "Conta atualizada com sucesso."
        : query.canceled === "1"
          ? "Conta cancelada e registrada no histórico."
          : query.paid === "1"
            ? "Pagamento registrado e salvo no histórico."
            : query.duplicated === "1"
              ? "Cópia criada com sucesso."
              : query.approvalRequested === "1"
                ? "Conta enviada para aprovação."
                : null;
  const hasPendingApproval = approvalHistory.some(
    (request) => request.status === "pending",
  );
  const hasApprovedRequest = approvalHistory.some(
    (request) => request.status === "approved",
  );
  const documents = attachments.filter(
    (attachment) => attachment.attachment_type !== "receipt",
  );

  return (
    <section className="app-page space-y-[var(--space-section)]">
      <PageHeader
        title={account.description}
        description="Consulte dados financeiros, documento, histórico e vínculos deste compromisso."
        breadcrumbs={[
          { label: "Contas a pagar", href: "/app/contas-a-pagar" },
          { label: account.description },
        ]}
        actions={
          <PayableDetailActions
            accountId={account.id}
            status={account.status}
            canWrite={canWrite}
            canMarkPaid={
              canRegisterPayment(
                workspace.activeOrganization.role,
                account.status,
              ) &&
              (approvalHistory.length === 0 || hasApprovedRequest)
            }
            canRequestApproval={
              !hasPendingApproval &&
              (["draft", "pending", "overdue"] as string[]).includes(
                account.status,
              )
            }
            totalCents={account.amount_cents}
            paidCents={paymentSummary.activePaidCents}
            allowPartialPayments={
              workspace.activeOrganization.allowPartialPayments
            }
            allowOverpayments={workspace.activeOrganization.allowOverpayments}
            overpaymentToleranceCents={
              workspace.activeOrganization.overpaymentToleranceCents
            }
          />
        }
      />

      {successMessage && (
        <div
          className="border-status-paid/30 bg-status-paid-muted text-status-paid-foreground rounded-xl border px-4 py-3 text-sm"
          role="status"
        >
          {successMessage}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.7fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Resumo financeiro</CardTitle>
                <StatusBadge status={account.status} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <DataItem label="Valor">
                <CurrencyDisplay
                  value={moneyInCents(account.amount_cents)}
                  className="text-xl font-semibold"
                />
              </DataItem>
              <DataItem label="Já pago">
                <CurrencyDisplay
                  value={moneyInCents(paymentSummary.activePaidCents)}
                />
              </DataItem>
              <DataItem label="Saldo restante">
                <CurrencyDisplay
                  value={moneyInCents(
                    Math.max(
                      account.amount_cents - paymentSummary.activePaidCents,
                      0,
                    ),
                  )}
                  className="font-semibold"
                />
              </DataItem>
              <DataItem label="Vencimento">
                <DateDisplay value={businessDate(account.due_date)} />
              </DataItem>
              {account.paid_date && (
                <DataItem label="Pagamento">
                  <DateDisplay value={businessDate(account.paid_date)} />
                </DataItem>
              )}
              <DataItem label="Fornecedor">
                {account.supplierName ?? "Não informado"}
              </DataItem>
              <DataItem label="Categoria">
                {account.categoryName ?? "Não informada"}
              </DataItem>
              <DataItem label="Origem">
                {PAYABLE_SOURCE_LABELS[account.source]}
              </DataItem>
              <DataItem label="Competência">
                {account.competence_date ? (
                  <DateDisplay value={businessDate(account.competence_date)} />
                ) : (
                  "Não informada"
                )}
              </DataItem>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Pagamentos</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentSummary.payments.length ? (
                <ol className="divide-y">
                  {paymentSummary.payments.map((payment) => {
                    const receipts = paymentSummary.receipts.filter(
                      (receipt) => receipt.payment_id === payment.id,
                    );
                    return (
                      <li
                        key={payment.id}
                        className="space-y-3 py-4 first:pt-0 last:pb-0"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <CurrencyDisplay
                                value={moneyInCents(payment.paid_amount_cents)}
                                className="font-semibold"
                              />
                              <span
                                className={
                                  payment.reversed_at
                                    ? "text-destructive text-xs font-medium"
                                    : "text-status-paid-foreground text-xs font-medium"
                                }
                              >
                                {payment.reversed_at
                                  ? "Estornado"
                                  : "Confirmado"}
                              </span>
                            </div>
                            <p className="text-muted-foreground mt-1 text-xs">
                              {paymentMethodLabel(payment.payment_method)} ·{" "}
                              {formatDateTime(
                                payment.paid_at,
                                workspace.activeOrganization.timezone,
                              )}
                            </p>
                            {payment.bank_reference && (
                              <p className="mt-1 text-xs">
                                Referência: {payment.bank_reference}
                              </p>
                            )}
                            {payment.notes && (
                              <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">
                                {payment.notes}
                              </p>
                            )}
                            {payment.reversal_reason && (
                              <p className="text-destructive mt-2 text-xs">
                                Motivo do estorno: {payment.reversal_reason}
                              </p>
                            )}
                          </div>
                          {!payment.reversed_at &&
                            (workspace.activeOrganization.role === "owner" ||
                              workspace.activeOrganization.role ===
                                "admin") && (
                              <PaymentReversalDialog
                                accountId={account.id}
                                paymentId={payment.id}
                              />
                            )}
                        </div>
                        {receipts.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {receipts.map((receipt) => (
                              <Button
                                asChild
                                key={receipt.id}
                                size="sm"
                                variant="outline"
                              >
                                <Link
                                  href={`/api/attachments/${receipt.id}/preview`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Ver comprovante
                                </Link>
                              </Button>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nenhum pagamento foi registrado nesta conta.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Documentos anexos</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length ? (
                <ul className="divide-y">
                  {documents.map((attachment) => (
                    <li
                      key={attachment.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {attachment.original_name}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {attachment.mime_type} ·{" "}
                          {Math.ceil(attachment.size_bytes / 1024)} KB
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/api/attachments/${attachment.id}/preview`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Visualizar
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nenhum documento foi vinculado a esta conta.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Histórico de aprovação</CardTitle>
            </CardHeader>
            <CardContent>
              {approvalHistory.length ? (
                <ol className="space-y-5">
                  {approvalHistory.map((request) => (
                    <li key={request.requestId} className="border-s-2 ps-3">
                      <p className="text-sm font-medium">
                        Solicitação {approvalStatusLabel(request.status)} ·{" "}
                        {request.decisions.length}/{request.requiredApprovals}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Solicitada por {request.requestedByName} em{" "}
                        {formatDateTime(
                          request.requestedAt,
                          workspace.activeOrganization.timezone,
                        )}
                      </p>
                      {request.decisions.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {request.decisions.map((decision) => (
                            <li
                              key={decision.id}
                              className="bg-muted/40 rounded-lg p-2.5 text-xs"
                            >
                              <span className="font-medium">
                                {decision.approverName}
                              </span>{" "}
                              {decision.decision === "approved"
                                ? "aprovou"
                                : "rejeitou"}{" "}
                              em{" "}
                              {formatDateTime(
                                decision.decidedAt,
                                workspace.activeOrganization.timezone,
                              )}
                              {decision.comment && (
                                <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                                  {decision.comment}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Esta conta ainda não passou por aprovação.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Informações do documento</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <DataItem label="Tipo">
                {PAYABLE_DOCUMENT_LABELS[account.document_type]}
              </DataItem>
              <DataItem label="Número">
                {account.document_number ?? "Não informado"}
              </DataItem>
              <DataItem label="Emissão">
                {account.issue_date ? (
                  <DateDisplay value={businessDate(account.issue_date)} />
                ) : (
                  "Não informada"
                )}
              </DataItem>
              <DataItem label="Linha digitável">
                <span className="font-mono text-xs break-all">
                  {account.barcode ?? "Não informada"}
                </span>
              </DataItem>
              {account.pix_code && (
                <DataItem label="Código Pix" className="sm:col-span-2">
                  <span className="font-mono text-xs break-all">
                    {account.pix_code}
                  </span>
                </DataItem>
              )}
              <DataItem label="Observações" className="sm:col-span-2">
                <span className="whitespace-pre-wrap">
                  {account.notes ?? "Nenhuma observação."}
                </span>
              </DataItem>
              {account.cancellation_reason && (
                <DataItem
                  label="Motivo do cancelamento"
                  className="sm:col-span-2"
                >
                  {account.cancellation_reason}
                </DataItem>
              )}
              {account.payment_notes && (
                <DataItem
                  label="Observação do pagamento"
                  className="sm:col-span-2"
                >
                  <span className="whitespace-pre-wrap">
                    {account.payment_notes}
                  </span>
                </DataItem>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Contas relacionadas</CardTitle>
            </CardHeader>
            <CardContent>
              {related.length > 1 ? (
                <ol className="divide-y">
                  {related.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div>
                        <Link
                          href={`/app/contas-a-pagar/${item.id}`}
                          className="font-medium hover:underline"
                        >
                          {item.installment_number
                            ? `Parcela ${item.installment_number}/${item.installment_total}`
                            : `Ocorrência ${item.occurrence_index}`}
                        </Link>
                        <p className="text-muted-foreground mt-1 text-xs">
                          <DateDisplay value={businessDate(item.due_date)} />
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Esta conta não pertence a um parcelamento ou recorrência.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              {audit.length > 0 ? (
                <ol className="space-y-4">
                  {audit.map((entry) => (
                    <li key={entry.id} className="border-s-2 ps-3">
                      <p className="text-sm font-medium">
                        {entry.action.endsWith(".insert")
                          ? "Conta cadastrada"
                          : "Conta atualizada"}
                      </p>
                      <time
                        dateTime={entry.createdAt}
                        className="text-muted-foreground mt-1 block text-xs"
                      >
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                          timeZone: workspace.activeOrganization.timezone,
                        }).format(new Date(entry.createdAt))}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground text-sm">
                  O histórico detalhado é visível para administradores e
                  proprietários.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Próximos módulos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PreparedArea
                icon={Paperclip}
                title="Anexos"
                description="Área preparada para documentos privados."
              />
              <PreparedArea
                icon={FileCheck2}
                title="Aprovação"
                description="Decisões e invalidações são registradas no histórico acima."
              />
              <PreparedArea
                icon={FileArchive}
                title="Comprovante"
                description="Nenhum pagamento é executado pela Vencii."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function DataItem({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-1.5 text-sm">{children}</div>
    </div>
  );
}

function PreparedArea({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ReceiptText;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="bg-secondary grid size-8 shrink-0 place-items-center rounded-lg">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mt-1 text-xs leading-5">
          {description}
        </p>
      </div>
    </div>
  );
}

function approvalStatusLabel(status: string) {
  return (
    {
      pending: "pendente",
      approved: "aprovada",
      rejected: "rejeitada",
      invalidated: "invalidada por alteração financeira",
    }[status] ?? status
  );
}

function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

function paymentMethodLabel(method: PaymentMethod) {
  return {
    boleto: "Boleto",
    pix: "Pix",
    transferencia: "Transferência",
    debito_automatico: "Débito automático",
    cartao: "Cartão",
    dinheiro: "Dinheiro",
    outro: "Outro",
  }[method];
}
