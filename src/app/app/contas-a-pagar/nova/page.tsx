import { randomUUID } from "node:crypto";
import type { Metadata } from "next";

import { createAccountPayableAction } from "@/app/actions/accounts-payable";
import { PayableForm } from "@/components/payables/payable-form";
import { ErrorState } from "@/components/product/error-state";
import { PageHeader } from "@/components/product/page-header";
import { PAYABLE_WRITE_ROLES } from "@/domain/payables/payable";
import { todayInTimeZone } from "@/domain/shared/timezone";
import { requireWorkspace } from "@/dal/workspace";
import { listPayableLookups } from "@/repositories/accounts-payable-server.repository";

export const metadata: Metadata = { title: "Nova conta" };

export default async function NewPayablePage() {
  const workspace = await requireWorkspace();
  const canWrite = (PAYABLE_WRITE_ROLES as readonly string[]).includes(
    workspace.activeOrganization.role,
  );
  if (!canWrite) {
    return (
      <section className="app-page">
        <ErrorState
          title="Cadastro não permitido"
          description="Seu papel nesta organização permite consultar contas, mas não criar lançamentos."
        />
      </section>
    );
  }
  const lookups = await listPayableLookups(workspace.activeOrganization.id);
  const today = todayInTimeZone(workspace.activeOrganization.timezone);

  return (
    <section className="app-page space-y-[var(--space-section)]">
      <PageHeader
        title="Nova conta"
        description="Cadastre uma conta única, parcelada ou recorrente. A prévia mostra todos os registros antes do envio."
        breadcrumbs={[
          { label: "Contas a pagar", href: "/app/contas-a-pagar" },
          { label: "Nova conta" },
        ]}
      />
      <PayableForm
        action={createAccountPayableAction}
        suppliers={lookups.suppliers}
        categories={lookups.categories}
        submitLabel="Cadastrar conta"
        defaultValues={{
          supplierId: "",
          expenseCategoryId: "",
          description: "",
          documentType: "boleto",
          documentNumber: "",
          barcode: "",
          pixCode: "",
          amount: "0,00",
          issueDate: "",
          dueDate: today,
          competenceDate: "",
          notes: "",
          mode: "single",
          installmentCount: 2,
          recurrenceFrequency: "monthly",
          recurrenceCount: 12,
          recurrenceEndDate: "",
          customIntervalDays: 30,
          idempotencyKey: randomUUID(),
        }}
      />
    </section>
  );
}
