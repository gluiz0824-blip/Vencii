"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { PAYABLE_WRITE_ROLES } from "@/domain/payables/payable";
import { requireWorkspace } from "@/dal/workspace";
import {
  cancelAccountPayable,
  findAccountPayable,
  markAccountPayablePaid,
} from "@/repositories/accounts-payable-server.repository";
import {
  createAccountsPayable,
  updateExistingAccountPayable,
} from "@/services/payables/accounts-payable.service";
import {
  payableFormSchema,
  payableUpdateSchema,
  paymentRegistrationSchema,
} from "@/validation/payable";

export interface PayableActionState {
  status: "idle" | "error" | "duplicate";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  duplicates?: string[];
}

function stringValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function formValues(formData: FormData) {
  return {
    supplierId: stringValue(formData, "supplierId"),
    expenseCategoryId: stringValue(formData, "expenseCategoryId"),
    description: stringValue(formData, "description"),
    documentType: stringValue(formData, "documentType"),
    documentNumber: stringValue(formData, "documentNumber"),
    barcode: stringValue(formData, "barcode"),
    pixCode: stringValue(formData, "pixCode"),
    amount: stringValue(formData, "amount"),
    issueDate: stringValue(formData, "issueDate"),
    dueDate: stringValue(formData, "dueDate"),
    competenceDate: stringValue(formData, "competenceDate"),
    notes: stringValue(formData, "notes"),
    mode: stringValue(formData, "mode"),
    installmentCount: Number(stringValue(formData, "installmentCount")),
    recurrenceFrequency: stringValue(formData, "recurrenceFrequency"),
    recurrenceCount: Number(stringValue(formData, "recurrenceCount")),
    recurrenceEndDate: stringValue(formData, "recurrenceEndDate"),
    customIntervalDays: Number(stringValue(formData, "customIntervalDays")),
    idempotencyKey: stringValue(formData, "idempotencyKey"),
  };
}

function canWrite(role: string): boolean {
  return (PAYABLE_WRITE_ROLES as readonly string[]).includes(role);
}

export async function createAccountPayableAction(
  _state: PayableActionState,
  formData: FormData,
): Promise<PayableActionState> {
  const workspace = await requireWorkspace();
  if (!canWrite(workspace.activeOrganization.role)) {
    return {
      status: "error",
      message: "Seu papel permite somente consultar contas.",
    };
  }

  const parsed = payableFormSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const result = await createAccountsPayable({
      organizationId: workspace.activeOrganization.id,
      userId: workspace.user.id,
      values: parsed.data,
      confirmDuplicates: stringValue(formData, "confirmDuplicates") === "true",
    });
    if (result.duplicateDescriptions.length > 0) {
      return {
        status: "duplicate",
        message:
          "Encontramos contas possivelmente duplicadas. Revise antes de continuar.",
        duplicates: result.duplicateDescriptions,
      };
    }
    revalidatePath("/app/contas-a-pagar");
    redirect(
      `/app/contas-a-pagar/${result.ids[0]}?created=${result.ids.length}`,
    );
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT"))
      throw error;
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar a conta.",
    };
  }
}

export async function updateAccountPayableAction(
  accountId: string,
  _state: PayableActionState,
  formData: FormData,
): Promise<PayableActionState> {
  const workspace = await requireWorkspace();
  if (!canWrite(workspace.activeOrganization.role)) {
    return {
      status: "error",
      message: "Seu papel permite somente consultar contas.",
    };
  }

  const parsed = payableUpdateSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const duplicates = await updateExistingAccountPayable({
      organizationId: workspace.activeOrganization.id,
      accountId,
      userId: workspace.user.id,
      values: parsed.data,
      confirmDuplicates: stringValue(formData, "confirmDuplicates") === "true",
    });
    if (duplicates.length > 0) {
      return {
        status: "duplicate",
        message: "A alteração se parece com outra conta existente.",
        duplicates,
      };
    }
    revalidatePath("/app/contas-a-pagar");
    revalidatePath(`/app/contas-a-pagar/${accountId}`);
    redirect(`/app/contas-a-pagar/${accountId}?updated=1`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT"))
      throw error;
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a conta.",
    };
  }
}

export async function cancelAccountPayableAction(
  accountId: string,
  formData: FormData,
): Promise<void> {
  const workspace = await requireWorkspace();
  if (!canWrite(workspace.activeOrganization.role))
    throw new Error("Sem permissão.");
  await cancelAccountPayable(
    workspace.activeOrganization.id,
    accountId,
    stringValue(formData, "reason"),
  );
  revalidatePath("/app/contas-a-pagar");
  revalidatePath(`/app/contas-a-pagar/${accountId}`);
  redirect(`/app/contas-a-pagar/${accountId}?canceled=1`);
}

export async function markAccountPayablePaidAction(
  accountId: string,
  formData: FormData,
): Promise<void> {
  const workspace = await requireWorkspace();
  if (!(
    "owner" === workspace.activeOrganization.role ||
    "admin" === workspace.activeOrganization.role
  ))
    throw new Error("Somente owner ou admin pode registrar um pagamento.");

  const parsed = paymentRegistrationSchema.safeParse({
    paidDate: stringValue(formData, "paidDate"),
    notes: stringValue(formData, "paymentNotes"),
  });
  if (!parsed.success)
    throw new Error(
      parsed.error.issues[0]?.message ?? "Dados do pagamento inválidos.",
    );

  await markAccountPayablePaid(
    workspace.activeOrganization.id,
    accountId,
    parsed.data.paidDate,
    parsed.data.notes,
  );
  revalidatePath("/app");
  revalidatePath("/app/contas-a-pagar");
  revalidatePath(`/app/contas-a-pagar/${accountId}`);
  redirect(`/app/contas-a-pagar/${accountId}?paid=1`);
}

export async function duplicateAccountPayableAction(
  accountId: string,
): Promise<void> {
  const workspace = await requireWorkspace();
  if (!canWrite(workspace.activeOrganization.role))
    throw new Error("Sem permissão.");
  const account = await findAccountPayable(
    workspace.activeOrganization.id,
    accountId,
  );
  if (!account) throw new Error("Conta não encontrada.");

  const amount = (account.amount_cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const result = await createAccountsPayable({
    organizationId: workspace.activeOrganization.id,
    userId: workspace.user.id,
    confirmDuplicates: true,
    values: {
      supplierId: account.supplier_id ?? "",
      expenseCategoryId: account.expense_category_id ?? "",
      description: `${account.description} (cópia)`,
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
      idempotencyKey: randomUUID(),
    },
  });
  revalidatePath("/app/contas-a-pagar");
  redirect(`/app/contas-a-pagar/${result.ids[0]}?duplicated=1`);
}
