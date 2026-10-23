"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { registerPaymentAction } from "@/app/actions/payments";
import { CurrencyDisplay } from "@/components/product/currency-display";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { moneyInCents } from "@/domain/shared/money";

function brlInput(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PaymentRegistrationDialog({
  accountId,
  totalCents,
  paidCents,
  allowPartialPayments,
  allowOverpayments,
  toleranceCents,
}: {
  accountId: string;
  totalCents: number;
  paidCents: number;
  allowPartialPayments: boolean;
  allowOverpayments: boolean;
  toleranceCents: number;
}) {
  const router = useRouter();
  const balanceCents = Math.max(totalCents - paidCents, 0);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const paidAt = String(formData.get("paidAt"));
      const result = await registerPaymentAction({
        accountId,
        amount: String(formData.get("amount")),
        paidAt: new Date(paidAt).toISOString(),
        paymentMethod: String(formData.get("paymentMethod")),
        bankReference: String(formData.get("bankReference") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        idempotencyKey,
        confirmOverpayment: formData.get("confirmOverpayment") === "on",
      });
      if (result.status === "error" || !result.paymentId) {
        setMessage(result.message);
        return;
      }
      const receipt = formData.get("receipt");
      if (receipt instanceof File && receipt.size > 0) {
        const upload = new FormData();
        upload.set("file", receipt);
        upload.set("accountPayableId", accountId);
        upload.set("paymentId", result.paymentId);
        upload.set("attachmentType", "receipt");
        const response = await fetch("/api/attachments", {
          method: "POST",
          body: upload,
        });
        if (!response.ok) {
          setMessage(
            "Pagamento salvo, mas o comprovante não foi enviado. Você pode tentar anexá-lo novamente.",
          );
          router.refresh();
          return;
        }
      }
      setIdempotencyKey(crypto.randomUUID());
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CheckCircle2 /> Registrar pagamento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            O Vencii apenas registra a operação; nenhum dinheiro será
            movimentado.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted/40 grid grid-cols-3 gap-3 rounded-lg p-3 text-sm">
          <div>
            <span className="text-muted-foreground block text-xs">
              Original
            </span>
            <CurrencyDisplay value={moneyInCents(totalCents)} />
          </div>
          <div>
            <span className="text-muted-foreground block text-xs">Já pago</span>
            <CurrencyDisplay value={moneyInCents(paidCents)} />
          </div>
          <div>
            <span className="text-muted-foreground block text-xs">Saldo</span>
            <CurrencyDisplay
              value={moneyInCents(balanceCents)}
              className="font-semibold"
            />
          </div>
        </div>
        <form action={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="paymentAmount">Valor pago</Label>
              <Input
                id="paymentAmount"
                name="amount"
                defaultValue={brlInput(balanceCents)}
                inputMode="decimal"
                required
                className="mt-1.5"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                {allowPartialPayments
                  ? "Pagamento parcial habilitado."
                  : "O valor deve quitar o saldo integralmente."}
              </p>
            </div>
            <div>
              <Label htmlFor="paidAt">Data e hora</Label>
              <Input
                id="paidAt"
                name="paidAt"
                type="datetime-local"
                required
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="paymentMethod">Método</Label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              required
              defaultValue="pix"
              className="border-input bg-background mt-1.5 h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="boleto">Boleto</option>
              <option value="pix">Pix</option>
              <option value="transferencia">Transferência</option>
              <option value="debito_automatico">Débito automático</option>
              <option value="cartao">Cartão</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div>
            <Label htmlFor="bankReference">
              Referência bancária{" "}
              <span className="font-normal">(opcional)</span>
            </Label>
            <Input
              id="bankReference"
              name="bankReference"
              maxLength={180}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="paymentNotes">
              Observações <span className="font-normal">(opcional)</span>
            </Label>
            <Textarea
              id="paymentNotes"
              name="notes"
              maxLength={1000}
              className="mt-1.5 min-h-20"
            />
          </div>
          <div>
            <Label htmlFor="receipt">
              Comprovante <span className="font-normal">(opcional)</span>
            </Label>
            <Input
              id="receipt"
              name="receipt"
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="mt-1.5"
            />
            <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
              <Upload className="size-3" /> PDF, PNG ou JPG, conforme o limite
              configurado.
            </p>
          </div>
          {allowOverpayments && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="confirmOverpayment"
                className="mt-1"
              />
              Confirmo um valor acima do saldo, limitado a{" "}
              {brlInput(toleranceCents)} de tolerância.
            </label>
          )}
          {message && (
            <p className="text-destructive text-sm" role="alert">
              {message}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Salvar pagamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
