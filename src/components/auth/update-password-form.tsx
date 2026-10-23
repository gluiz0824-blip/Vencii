"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { updatePasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_FORM_STATE } from "@/validation/form-state";

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(
    updatePasswordAction,
    INITIAL_FORM_STATE,
  );
  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="new-password">Nova senha</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
        {state.fieldErrors?.password && (
          <p className="text-destructive text-xs">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password-confirmation">Confirmar nova senha</Label>
        <Input
          id="new-password-confirmation"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(state.fieldErrors?.passwordConfirmation)}
        />
        {state.fieldErrors?.passwordConfirmation && (
          <p className="text-destructive text-xs">
            {state.fieldErrors.passwordConfirmation[0]}
          </p>
        )}
      </div>
      {state.message && (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" /> Salvando...
          </>
        ) : (
          "Salvar nova senha"
        )}
      </Button>
    </form>
  );
}
