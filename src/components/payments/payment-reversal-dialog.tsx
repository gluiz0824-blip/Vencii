"use client";

import { useState, useTransition } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

import { reversePaymentAction } from "@/app/actions/payments";
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

export function PaymentReversalDialog({
  accountId,
  paymentId,
}: {
  accountId: string;
  paymentId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <RotateCcw /> Estornar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Estornar este pagamento?</DialogTitle>
          <DialogDescription>
            O registro não será apagado. A data, o usuário e o motivo do estorno
            permanecerão no histórico.
          </DialogDescription>
        </DialogHeader>
        <form
          action={(formData) =>
            startTransition(async () => {
              const result = await reversePaymentAction(accountId, {
                paymentId,
                reason: String(formData.get("reason") ?? ""),
                confirmation: String(formData.get("confirmation") ?? ""),
              });
              if (result.status === "error") return setMessage(result.message);
              setOpen(false);
              router.refresh();
            })
          }
          className="space-y-4"
        >
          <div>
            <Label htmlFor={`reason-${paymentId}`}>Motivo do estorno</Label>
            <Textarea
              id={`reason-${paymentId}`}
              name="reason"
              required
              minLength={3}
              maxLength={500}
              className="mt-1.5 min-h-24"
            />
          </div>
          <div>
            <Label htmlFor={`confirmation-${paymentId}`}>
              Digite ESTORNAR para confirmar
            </Label>
            <Input
              id={`confirmation-${paymentId}`}
              name="confirmation"
              required
              autoComplete="off"
              className="mt-1.5"
            />
          </div>
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
              Voltar
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Confirmar
              estorno
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
