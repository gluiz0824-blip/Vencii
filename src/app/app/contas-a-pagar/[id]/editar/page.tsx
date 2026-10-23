import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateAccountPayableAction } from "@/app/actions/accounts-payable";
import { PayableForm } from "@/components/payables/payable-form";
import { ErrorState } from "@/components/product/error-state";
import { PageHeader } from "@/components/product/page-header";
import {
  PAYABLE_WRITE_ROLES,
  canEditFinancialFields,
} from "@/domain/payables/payable";
import { requireWorkspace } from "@/dal/workspace";
import {
  findAccountPayable,
  listPayableLookups,
} from "@/repositories/accounts-payable-server.repository";

export const metadata: Metadata = { title: "Editar conta" };

export default async function EditPayablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, workspace] = await Promise.all([params, requireWorkspace()]);
  const canWrite = (PAYABLE_WRITE_ROLES as readonly string[]).includes(
    workspace.activeOrganization.role,
  );
  if (!canWrite) {
    return (
      <section className="app-page">
        <ErrorState
          title="Edição não permitida"
          description="Seu papel permite somente consultar esta conta."
        />
      </section>
    );
  }
  const [account, lookups] = await Promise.all([
    findAccountPayable(workspace.activeOrganization.id, id),
    listPayableLookups(workspace.activeOrganization.id),
  ]);
  if (!account) notFound();
  const amount = (account.amount_cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <section className="app-page space-y-[var(--space-section)]">
      <PageHeader
        title="Editar conta"
        description={
          canEditFinancialFields(account.status)
            ? "Atualize os dados do compromisso. Mudanças relevantes ficam no histórico."
            : "Esta conta foi finalizada; somente observações podem ser atualizadas."
        }
        breadcrumbs={[
          { label: "Contas a pagar", href: "/app/contas-a-pagar" },
          {
            label: account.description,
            href: `/app/contas-a-pagar/${account.id}`,
          },
          { label: "Editar" },
        ]}
      />
      <PayableForm
        action={updateAccountPayableAction.bind(null, account.id)}
        suppliers={lookups.suppliers}
        categories={lookups.categories}
        submitLabel="Salvar alterações"
        showSchedule={false}
        financialLocked={!canEditFinancialFields(account.status)}
        defaultValues={{
          supplierId: account.supplier_id ?? "",
          expenseCategoryId: account.expense_category_id ?? "",
          description: account.description,
          documentType: account.document_type,
          documentNumber: account.document_number ?? "",
          barcode: account.barcode ?? "",
          pixCode: account.pix_code ?? "",
          amount,
          issueDate: account.issue_date ?? "",
          dueDate: account.due_date,
          competenceDate: account.competence_date ?? "",
          notes: account.notes ?? "",
          mode: "single",
          installmentCount: 2,
          recurrenceFrequency: "monthly",
          recurrenceCount: 1,
          recurrenceEndDate: "",
          customIntervalDays: 30,
          idempotencyKey: account.idempotency_key,
        }}
      />
    </section>
  );
}
