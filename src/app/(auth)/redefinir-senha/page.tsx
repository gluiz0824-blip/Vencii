import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/services/auth/auth-server.service";

export const metadata: Metadata = { title: "Redefinir senha" };

export default async function UpdatePasswordPage() {
  if (!(await getCurrentUser())) redirect("/entrar");
  return (
    <Card className="shadow-primary/5 w-full max-w-md shadow-xl">
      <CardHeader className="px-6 pt-7 sm:px-8">
        <CardTitle className="text-2xl tracking-tight">
          <h1>Defina uma nova senha</h1>
        </CardTitle>
        <CardDescription>
          Use pelo menos 8 caracteres, com letras e números.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-7 sm:px-8">
        <UpdatePasswordForm />
      </CardContent>
    </Card>
  );
}
