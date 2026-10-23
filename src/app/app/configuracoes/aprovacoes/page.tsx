import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  setSelfApprovalAction,
  toggleApprovalRuleAction,
} from "@/app/actions/approvals";
import { ApprovalRuleForm } from "@/components/approvals/approval-rule-form";
import { EmptyState } from "@/components/product/empty-state";
import { PageHeader } from "@/components/product/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspace } from "@/dal/workspace";
import { listPayableLookups } from "@/repositories/accounts-payable-server.repository";
import { listApprovalRules } from "@/repositories/approval-server.repository";

export const metadata: Metadata = { title: "Regras de aprovação" };

function formatAmount(cents: number | null) {
  return cents === null
    ? null
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(cents / 100);
}

export default async function ApprovalSettingsPage() {
  const workspace = await requireWorkspace();
  const organization = workspace.activeOrganization;
  const canManage =
    organization.role === "owner" || organization.role === "admin";

  if (!canManage) {
    return (
      <section className="app-page space-y-[var(--space-section)]">
        <PageHeader
          title="Regras de aprovação"
          description="Configure quando e quantas aprovações uma conta exige."
          breadcrumbs={[
            { label: "Configurações", href: "/app/configuracoes" },
            { label: "Aprovações" },
          ]}
        />
        <EmptyState
          title="Configuração restrita"
          description="Somente owner ou admin pode alterar regras de aprovação."
          icon={ShieldCheck}
        />
      </section>
    );
  }

  const [rules, lookups] = await Promise.all([
    listApprovalRules(organization.id),
    listPayableLookups(organization.id),
  ]);

  return (
    <section className="app-page space-y-[var(--space-section)]">
      <PageHeader
        title="Regras de aprovação"
        description="Defina faixas, fornecedores, categorias e o número de decisões necessárias."
        breadcrumbs={[
          { label: "Configurações", href: "/app/configuracoes" },
          { label: "Aprovações" },
        ]}
        actions={
          <Button asChild variant="outline">
            <Link href="/app/configuracoes">
              <ArrowLeft /> Voltar
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Política de autoaprovação</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">
              Quem cadastrou a conta pode aprová-la
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              O padrão seguro é desativado. A mudança vale para novas decisões.
            </p>
          </div>
          <form action={setSelfApprovalAction}>
            <input
              type="hidden"
              name="allow"
              value={organization.allowSelfApproval ? "false" : "true"}
            />
            <Button
              type="submit"
              variant={
                organization.allowSelfApproval ? "destructive" : "outline"
              }
            >
              {organization.allowSelfApproval
                ? "Desativar autoaprovação"
                : "Permitir autoaprovação"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Nova regra</CardTitle>
          </CardHeader>
          <CardContent>
            <ApprovalRuleForm
              suppliers={lookups.suppliers}
              categories={lookups.categories}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Regras existentes</CardTitle>
          </CardHeader>
          <CardContent>
            {rules.length ? (
              <ol className="divide-y">
                {rules.map((rule) => (
                  <li key={rule.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{rule.name}</p>
                          <Badge
                            variant={rule.active ? "secondary" : "outline"}
                          >
                            {rule.active ? "Ativa" : "Inativa"}
                          </Badge>
                          <Badge variant="outline">
                            Prioridade {rule.priority}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-2 text-xs leading-5">
                          {rule.min_amount_cents === null &&
                          rule.max_amount_cents === null
                            ? "Qualquer valor"
                            : `${formatAmount(rule.min_amount_cents) ?? "Sem mínimo"} até ${formatAmount(rule.max_amount_cents) ?? "sem limite"}`}{" "}
                          · {rule.categoryName ?? "Todas as categorias"} ·{" "}
                          {rule.supplierName ?? "Todos os fornecedores"}
                        </p>
                        <p className="mt-1 text-xs font-medium">
                          {rule.required_approvals}{" "}
                          {rule.required_approvals === 1
                            ? "aprovação necessária"
                            : "aprovações necessárias"}
                        </p>
                      </div>
                      <form
                        action={toggleApprovalRuleAction.bind(null, rule.id)}
                      >
                        <input
                          type="hidden"
                          name="active"
                          value={rule.active ? "false" : "true"}
                        />
                        <Button type="submit" size="sm" variant="outline">
                          {rule.active ? "Desativar" : "Ativar"}
                        </Button>
                      </form>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground text-sm">
                Nenhuma regra configurada. Contas ainda podem ser enviadas
                manualmente.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
