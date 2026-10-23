"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { signUpAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_FORM_STATE } from "@/validation/form-state";

export function SignUpForm() {
  const [state, action, pending] = useActionState(
    signUpAction,
    INITIAL_FORM_STATE,
  );

  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          aria-invalid={Boolean(state.fieldErrors?.fullName)}
        />
        {state.fieldErrors?.fullName && (
          <p className="text-destructive text-xs">
            {state.fieldErrors.fullName[0]}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">E-mail profissional</Label>
        <Input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@empresa.com.br"
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
        {state.fieldErrors?.email && (
          <p className="text-destructive text-xs">
            {state.fieldErrors.email[0]}
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="signup-password">Senha</Label>
          <Input
            id="signup-password"
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
          <Label htmlFor="passwordConfirmation">Confirmar senha</Label>
          <Input
            id="passwordConfirmation"
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
      </div>
      {state.message && (
        <p
          role="status"
          className={
            state.status === "success"
              ? "rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"
              : "border-destructive/20 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
          }
        >
          {state.message}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="h-11 w-full"
        disabled={pending}
      >
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" /> Criando conta...
          </>
        ) : (
          <>
            Criar conta <ArrowRight />
          </>
        )}
      </Button>
    </form>
  );
}
