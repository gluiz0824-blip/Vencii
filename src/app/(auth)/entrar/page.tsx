import type { Metadata } from "next";
import Link from "next/link";

import { SignInForm } from "@/components/auth/sign-in-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Entrar" };

export default function SignInPage() {
  return (
    <Card className="shadow-primary/5 w-full max-w-md shadow-xl">
      <CardHeader className="px-6 pt-7 sm:px-8">
        <CardTitle className="text-2xl tracking-tight">
          <h1>Bem-vindo de volta</h1>
        </CardTitle>
        <CardDescription className="leading-6">
          Acesse o ambiente seguro da sua organização.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-7 sm:px-8">
        <SignInForm />
        <p className="text-muted-foreground mt-6 text-center text-xs leading-5">
          Ainda não tem uma conta?{" "}
          <Link
            href="/cadastro"
            className="text-primary font-semibold hover:underline"
          >
            Criar conta
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
