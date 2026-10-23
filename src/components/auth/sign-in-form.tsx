"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { signInAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_FORM_STATE } from "@/validation/form-state";

export function SignInForm() {
  const [state, action, pending] = useActionState(
    signInAction,
    INITIAL_FORM_STATE,
  );

  return (
    <form action={action} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail profissional</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@empresa.com.br"
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={
            state.fieldErrors?.email ? "email-error" : undefined
          }
        />
        {state.fieldErrors?.email && (
          <p id="email-error" className="text-destructive text-xs">
            {state.fieldErrors.email[0]}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="password">Senha</Label>
          <Link
            href="/recuperar-senha"
            className="text-primary text-xs font-medium hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={
            state.fieldErrors?.password ? "password-error" : undefined
          }
        />
        {state.fieldErrors?.password && (
          <p id="password-error" className="text-destructive text-xs">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>
      {state.message && (
        <p
          role="alert"
          className="border-destructive/20 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
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
            <LoaderCircle className="animate-spin" /> Entrando...
          </>
        ) : (
          <>
            Entrar <ArrowRight />
          </>
        )}
      </Button>
    </form>
  );
}
