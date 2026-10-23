import { ArrowLeft, Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <Card className="shadow-primary/5 w-full max-w-md shadow-xl">
      <CardHeader className="px-6 pt-7 sm:px-8">
        <span className="bg-primary/10 text-primary mb-2 grid size-10 place-items-center rounded-xl">
          <Mail className="size-5" />
        </span>
        <CardTitle className="text-2xl tracking-tight">
          <h1>Recuperar acesso</h1>
        </CardTitle>
        <CardDescription className="leading-6">
          Enviaremos um link seguro para definir uma nova senha.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-7 sm:px-8">
        <PasswordRecoveryForm />
        <Button asChild variant="ghost" className="mt-5 w-full">
          <Link href="/entrar">
            <ArrowLeft /> Voltar para o login
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
