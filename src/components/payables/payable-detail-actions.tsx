"use client";

import { Ban, Copy, Pencil, Send } from "lucide-react";
import Link from "next/link";

import {
  cancelAccountPayableAction,
  duplicateAccountPayableAction,
} from "@/app/actions/accounts-payable";
import { requestPayableApprovalAction } from "@/app/actions/approvals";
import { PaymentRegistrationDialog } from "@/components/payments/payment-registration-dialog";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { canEditFinancialFields } from "@/domain/payables/payable";
import type { PayableStatus } from "@/types/database";

export function PayableDetailActions({
  accountId,
  status,
  canWrite,
  canMarkPaid,
  canRequestApproval,
  totalCents,
  paidCents,
  allowPartialPayments,
  allowOverpayments,
  overpaymentToleranceCents,
}: {
  accountId: string;
  status: PayableStatus;
  canWrite: boolean;
  canMarkPaid: boolean;
  canRequestApproval: boolean;
  totalCents: number;
  paidCents: number;
  allowPartialPayments: boolean;
  allowOverpayments: boolean;
  overpaymentToleranceCents: number;
}) {
  if (!canWrite) return null;
  const canCancel = !(
    ["partial", "paid", "canceled", "rejected"] as PayableStatus[]
  ).includes(status);

  return (
    <>
      {canRequestApproval && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>
              <Send /> Enviar para aprovação
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Enviar esta conta para aprovação?
              </AlertDialogTitle>
              <AlertDialogDescription>
                A regra mais específica será aplicada. Se nenhuma regra
                corresponder, será exigida uma aprovação.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <form action={requestPayableApprovalAction.bind(null, accountId)}>
                <AlertDialogAction type="submit">
                  Confirmar envio
                </AlertDialogAction>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {canMarkPaid && (
        <PaymentRegistrationDialog
          accountId={accountId}
          totalCents={totalCents}
          paidCents={paidCents}
          allowPartialPayments={allowPartialPayments}
          allowOverpayments={allowOverpayments}
          toleranceCents={overpaymentToleranceCents}
        />
      )}

      <Button asChild variant="outline">
        <Link href={`/app/contas-a-pagar/${accountId}/editar`}>
          <Pencil /> Editar
        </Link>
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline">
            <Copy /> Duplicar
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicar esta conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Uma nova conta será criada com os mesmos dados e identificada como
              cópia. Nenhum pagamento será executado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <form action={duplicateAccountPayableAction.bind(null, accountId)}>
              <AlertDialogAction type="submit">
                Duplicar conta
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canCancel && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Ban /> Cancelar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <form action={cancelAccountPayableAction.bind(null, accountId)}>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar esta conta?</AlertDialogTitle>
                <AlertDialogDescription>
                  O cancelamento fica registrado no histórico e exige uma
                  justificativa.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="my-4">
                <Label htmlFor="reason">Motivo do cancelamento</Label>
                <Textarea
                  id="reason"
                  name="reason"
                  required
                  minLength={3}
                  maxLength={500}
                  className="mt-1.5 min-h-24"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction
                  type="submit"
                  className="bg-destructive hover:bg-destructive/90 text-white"
                >
                  Confirmar cancelamento
                </AlertDialogAction>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {!canEditFinancialFields(status) && (
        <span className="sr-only">
          Somente as observações podem ser editadas neste estado.
        </span>
      )}
    </>
  );
}
