import {
  Building2,
  CheckCheck,
  CreditCard,
  BellRing,
  LockKeyhole,
  UsersRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/product/page-header";
import { PermissionGuard } from "@/components/product/permission-guard";
import { ResponsiveFormLayout } from "@/components/product/responsive-form-layout";
import { SuccessState } from "@/components/product/success-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspace } from "@/dal/workspace";
import type { OrganizationRole } from "@/types/database";

export const metadata: Metadata = { title: "Configurações" };

const roleLabels: Record<OrganizationRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  approver: "Aprovador",
  operator: "Operador",
  viewer: "Leitor",
};

export default async function SettingsPage() {
  const { activeOrganization } = await requireWorkspace();

  return (
    <section className="app-page space-y-[var(--space-section)]">
      <PageHeader
        title="Configurações"
        description="Consulte a identidade e as preferências atualmente ativas para esta organização."
        breadcrumbs={[
          { label: "Visão geral", href: "/app" },
          { label: "Configurações" },
        ]}
      />

      <ResponsiveFormLayout
        aside={
          <Card className="shadow-card gap-0 py-0">
            <CardHeader className="border-b px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <LockKeyhole
                  className="text-primary size-4"
                  aria-hidden="true"
                />
                Seu acesso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              <Badge variant="secondary">
                {roleLabels[activeOrganization.role]}
              </Badge>
              <p className="text-muted-foreground text-xs leading-5">
                As permissões são verificadas no servidor e pelas policies do
                banco.
              </p>
              <PermissionGuard
                role={activeOrganization.role}
                allowed={["owner", "admin"]}
                fallback={
                  <p className="bg-muted/40 text-muted-foreground rounded-lg border p-3 text-xs leading-5">
                    Alterações administrativas exigem owner ou admin.
                  </p>
                }
              >
                <SuccessState
                  title="Acesso administrativo confirmado"
                  description="Você poderá administrar esta organização quando os formulários forem habilitados."
                />
              </PermissionGuard>
            </CardContent>
          </Card>
        }
      >
        <Card className="shadow-card gap-0 py-0">
          <CardHeader className="border-b px-5 py-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="text-primary size-4" aria-hidden="true" />
              Dados da organização
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <dl className="divide-y">
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-[11rem_1fr] sm:px-6">
                <dt className="text-muted-foreground text-sm">Razão social</dt>
                <dd className="min-w-0 text-sm font-medium break-words">
                  {activeOrganization.legalName}
                </dd>
              </div>
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-[11rem_1fr] sm:px-6">
                <dt className="text-muted-foreground text-sm">Nome fantasia</dt>
                <dd className="min-w-0 text-sm font-medium break-words">
                  {activeOrganization.tradeName}
                </dd>
              </div>
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-[11rem_1fr] sm:px-6">
                <dt className="text-muted-foreground text-sm">Fuso horário</dt>
                <dd className="font-mono text-sm">
                  {activeOrganization.timezone}
                </dd>
              </div>
              <div className="grid gap-1 px-5 py-4 sm:grid-cols-[11rem_1fr] sm:px-6">
                <dt className="text-muted-foreground text-sm">Moeda</dt>
                <dd className="font-mono text-sm">
                  {activeOrganization.currency}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="shadow-card mt-5 gap-0 py-0">
          <CardHeader className="border-b px-5 py-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <BellRing className="text-primary size-4" aria-hidden="true" />
              Notificações
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-muted-foreground max-w-xl text-sm leading-6">
              Configure lembretes internos e por e-mail para sua conta.
            </p>
            <Button asChild variant="outline">
              <Link href="/app/configuracoes/notificacoes">
                Configurar notificações
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card mt-5 gap-0 py-0">
          <CardHeader className="border-b px-5 py-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <UsersRound className="text-primary size-4" aria-hidden="true" />
              Membros e permissões
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-8 sm:px-6">
            <p className="text-muted-foreground max-w-xl text-sm leading-6">
              A base de papéis e isolamento multiempresa está ativa. A gestão
              visual de membros e convites será adicionada em um módulo próprio.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card mt-5 gap-0 py-0">
          <CardHeader className="border-b px-5 py-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="text-primary size-4" aria-hidden="true" />{" "}
              Pagamentos
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-muted-foreground max-w-xl text-sm leading-6">
              Defina pagamento parcial e tolerância para valores acima do saldo.
            </p>
            <Button asChild variant="outline">
              <Link href="/app/configuracoes/pagamentos">
                Configurar pagamentos
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card mt-5 gap-0 py-0">
          <CardHeader className="border-b px-5 py-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCheck className="text-primary size-4" aria-hidden="true" />
              Aprovações
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-muted-foreground max-w-xl text-sm leading-6">
              Configure faixas de valor, fornecedores, categorias e quantidade
              de aprovadores.
            </p>
            <Button asChild variant="outline">
              <Link href="/app/configuracoes/aprovacoes">
                Configurar aprovações
              </Link>
            </Button>
          </CardContent>
        </Card>
      </ResponsiveFormLayout>
    </section>
  );
}
