import type { Metadata } from "next";
import Link from "next/link";

import { SignUpForm } from "@/components/auth/sign-up-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return (
    <Card className="shadow-primary/5 w-full max-w-xl shadow-xl">
      <CardHeader className="px-6 pt-7 sm:px-8">
        <CardTitle className="text-2xl tracking-tight">
          <h1>Crie sua conta</h1>
        </CardTitle>
        <CardDescription className="leading-6">
          Depois da confirmação, você configurará a primeira organização.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-7 sm:px-8">
        <SignUpForm />
        <p className="text-muted-foreground mt-6 text-center text-xs">
          Já tem acesso?{" "}
          <Link
            href="/entrar"
            className="text-primary font-semibold hover:underline"
          >
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
