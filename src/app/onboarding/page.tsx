import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { findActiveOrganizations } from "@/repositories/organization-server.repository";
import { getCurrentUser } from "@/services/auth/auth-server.service";

export const metadata: Metadata = { title: "Configurar organização" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  if ((await findActiveOrganizations(user.id)).length > 0)
    redirect("/selecionar-organizacao");

  return (
    <main className="bg-muted/30 min-h-screen px-5 py-8 sm:py-12">
      <div className="mx-auto mb-8 flex max-w-2xl items-center justify-between">
        <BrandLogo />
        <ThemeToggle />
      </div>
      <Card className="shadow-primary/5 mx-auto w-full max-w-2xl shadow-xl">
        <CardHeader className="border-b px-6 pb-5 sm:px-8">
          <p className="text-primary text-xs font-semibold tracking-wider uppercase">
            Primeira configuração
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Prepare seu ambiente Vencii
          </h1>
        </CardHeader>
        <CardContent className="px-6 pt-6 pb-7 sm:px-8">
          <OnboardingForm
            defaultName={String(user.user_metadata.full_name ?? "")}
          />
        </CardContent>
      </Card>
    </main>
  );
}
