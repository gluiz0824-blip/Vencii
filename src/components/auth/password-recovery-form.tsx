"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useActionState } from "react";

import { requestPasswordResetAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_FORM_STATE } from "@/validation/form-state";

export function PasswordRecoveryForm() {
  const [state, action, pending] = useActionState(
    requestPasswordResetAction,
    INITIAL_FORM_STATE,
  );
  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="recovery-email">E-mail profissional</Label>
        <Input
          id="recovery-email"
          name="email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
        {state.fieldErrors?.email && (
          <p className="text-destructive text-xs">
            {state.fieldErrors.email[0]}
          </p>
        )}
      </div>
      {state.message && (
        <p
          role="status"
          className={
            state.status === "success"
              ? "rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"
              : "text-destructive text-sm"
          }
        >
          {state.message}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" /> Enviando...
          </>
        ) : (
          <>
            <Send /> Enviar instruções
          </>
        )}
      </Button>
    </form>
  );
}
