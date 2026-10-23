"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireWorkspace } from "@/dal/workspace";
import { PAYABLE_WRITE_ROLES } from "@/domain/payables/payable";
import { reviewAttachment } from "@/repositories/attachment-server.repository";
import { isInboundAttachment } from "@/repositories/inbound-email-server.repository";
import { createAccountsPayable } from "@/services/payables/accounts-payable.service";
import type { Json, PayableDocumentType } from "@/types/database";
import { attachmentReviewSchema } from "@/validation/attachment";

export interface AttachmentReviewState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

function value(data: FormData, name: string): string {
  const item = data.get(name);
  return typeof item === "string" ? item : "";
}

function documentType(barcode: string, pixCode: string): PayableDocumentType {
  if (barcode) return "boleto";
  if (pixCode) return "pix";
  return "outro";
}

export async function reviewAttachmentAction(
  attachmentId: string,
  _state: AttachmentReviewState,
  formData: FormData,
): Promise<AttachmentReviewState> {
  const workspace = await requireWorkspace();
  if (
    !(PAYABLE_WRITE_ROLES as readonly string[]).includes(
      workspace.activeOrganization.role,
    )
  )
    return {
      status: "error",
      message: "Sem permissão para revisar documentos.",
    };
  const parsed = attachmentReviewSchema.safeParse({
    mode: value(formData, "mode"),
    accountPayableId: value(formData, "accountPayableId"),
    description: value(formData, "description"),
    supplierName: value(formData, "supplierName"),
    taxId: value(formData, "taxId"),
    amount: value(formData, "amount"),
    issueDate: value(formData, "issueDate"),
    dueDate: value(formData, "dueDate"),
    barcode: value(formData, "barcode"),
    pixCode: value(formData, "pixCode"),
    documentNumber: value(formData, "documentNumber"),
  });
  if (!parsed.success)
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  if (parsed.data.mode === "existing" && !parsed.data.accountPayableId)
    return {
      status: "error",
      message: "Selecione a conta que receberá o documento.",
    };
  try {
    let accountId = parsed.data.accountPayableId || null;
    if (parsed.data.mode === "new") {
      const receivedByEmail = await isInboundAttachment(
        workspace.activeOrganization.id,
        attachmentId,
      );
      const result = await createAccountsPayable({
        organizationId: workspace.activeOrganization.id,
        userId: workspace.user.id,
        confirmDuplicates: true,
        source: receivedByEmail ? "email" : "upload",
        values: {
          supplierId: "",
          expenseCategoryId: "",
          description: parsed.data.description,
          documentType: documentType(parsed.data.barcode, parsed.data.pixCode),
          documentNumber: parsed.data.documentNumber,
          barcode: parsed.data.barcode,
          pixCode: parsed.data.pixCode,
          amount: parsed.data.amount,
          issueDate: parsed.data.issueDate,
          dueDate: parsed.data.dueDate,
          competenceDate: "",
          notes: parsed.data.supplierName
            ? `Fornecedor identificado no documento: ${parsed.data.supplierName}`
            : "",
          mode: "single",
          installmentCount: 2,
          recurrenceFrequency: "monthly",
          recurrenceCount: 1,
          recurrenceEndDate: "",
          customIntervalDays: 30,
          idempotencyKey: `attachment-${attachmentId}`,
        },
      });
      accountId = result.ids[0] ?? null;
    }
    await reviewAttachment({
      organizationId: workspace.activeOrganization.id,
      attachmentId,
      accountPayableId: accountId,
      data: parsed.data as unknown as Json,
    });
    revalidatePath("/app/contas-a-pagar");
    redirect(
      accountId
        ? `/app/contas-a-pagar/${accountId}?attachment=1`
        : "/app/contas-a-pagar",
    );
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT"))
      throw error;
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a revisão.",
    };
  }
}
