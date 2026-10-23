"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import {
  updatePaymentSettingsAction,
  type PaymentActionResult,
} from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: PaymentActionResult = { status: "success", message: "" };

export function PaymentSettingsForm({
  allowPartialPayments,
  allowOverpayments,
  toleranceCents,
}: {
  allowPartialPayments: boolean;
  allowOverpayments: boolean;
  toleranceCents: number;
}) {
  const [state, action, pending] = useActionState(
    updatePaymentSettingsAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-5">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="allowPartialPayments"
          defaultChecked={allowPartialPayments}
          className="mt-1 size-4"
        />
        <span>
          <span className="block text-sm font-medium">
            Permitir pagamentos parciais
          </span>
          <span className="text-muted-foreground mt-1 block text-xs">
            O saldo restante continua aberto e a conta recebe o badge de
            pagamento parcial.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="allowOverpayments"
          defaultChecked={allowOverpayments}
          className="mt-1 size-4"
        />
        <span>
          <span className="block text-sm font-medium">
            Permitir valor acima do saldo
          </span>
          <span className="text-muted-foreground mt-1 block text-xs">
            Ainda exige confirmação explícita em cada registro.
          </span>
        </span>
      </label>
      <div className="max-w-xs">
        <Label htmlFor="overpaymentTolerance">Tolerância máxima (R$)</Label>
        <Input
          id="overpaymentTolerance"
          name="overpaymentTolerance"
          defaultValue={(toleranceCents / 100).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          inputMode="decimal"
          className="mt-1.5"
          required
        />
      </div>
      {state.message && (
        <p
          className={
            state.status === "error"
              ? "text-destructive text-sm"
              : "text-status-paid-foreground text-sm"
          }
          role="status"
        >
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Salvar preferências
      </Button>
    </form>
  );
}
