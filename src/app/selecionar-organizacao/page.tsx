import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OrganizationSelectionList } from "@/components/organization/organization-selection-list";
import { BrandLogo } from "@/components/shared/brand-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getWorkspaceState } from "@/dal/workspace";

export const metadata: Metadata = { title: "Selecionar organização" };

export default async function SelectOrganizationPage() {
  const state = await getWorkspaceState();
  if (state.organizations.length === 0) redirect("/onboarding");
  return (
    <main className="bg-muted/30 grid min-h-screen place-items-center px-5 py-12">
      <div className="w-full max-w-xl">
        <BrandLogo className="mb-7" />
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              <h1>Qual organização você quer acessar?</h1>
            </CardTitle>
            <CardDescription>
              A seleção fica ativa até você trocar de empresa ou sair.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationSelectionList organizations={state.organizations} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
