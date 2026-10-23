import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PaymentSettingsForm } from "@/components/payments/payment-settings-form";
import { EmptyState } from "@/components/product/empty-state";
import { PageHeader } from "@/components/product/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspace } from "@/dal/workspace";

export const metadata: Metadata = { title: "Preferências de pagamento" };

export default async function PaymentSettingsPage() {
  const { activeOrganization } = await requireWorkspace();
  const canManage =
    activeOrganization.role === "owner" || activeOrganization.role === "admin";
  return (
    <section className="app-page space-y-[var(--space-section)]">
      <PageHeader
        title="Preferências de pagamento"
        description="Controle pagamentos parciais e a tolerância para valores acima do saldo."
        breadcrumbs={[
          { label: "Configurações", href: "/app/configuracoes" },
          { label: "Pagamentos" },
        ]}
        actions={
          <Button asChild variant="outline">
            <Link href="/app/configuracoes">
              <ArrowLeft /> Voltar
            </Link>
          </Button>
        }
      />
      {!canManage ? (
        <EmptyState
          title="Configuração restrita"
          description="Somente owner ou admin pode alterar as preferências de pagamento."
          icon={ShieldCheck}
        />
      ) : (
        <Card className="max-w-2xl">
          <CardHeader className="border-b">
            <CardTitle>Política de registro</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentSettingsForm
              allowPartialPayments={activeOrganization.allowPartialPayments}
              allowOverpayments={activeOrganization.allowOverpayments}
              toleranceCents={activeOrganization.overpaymentToleranceCents}
            />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
