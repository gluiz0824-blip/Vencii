import { NextResponse } from "next/server";

import { getApiWorkspace } from "@/dal/api-workspace";
import { uploadDocument } from "@/services/attachments/attachment.service";
import { InvalidDocumentError } from "@/validation/attachment";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const workspace = await getApiWorkspace();
  if (!workspace)
    return NextResponse.json(
      { message: "Sessão ou organização inválida." },
      { status: 401 },
    );
  if (!workspace.canWrite)
    return NextResponse.json(
      { message: "Sem permissão para enviar documentos." },
      { status: 403 },
    );
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const accountPayableId = formData.get("accountPayableId");
    const paymentId = formData.get("paymentId");
    const attachmentType = formData.get("attachmentType");
    if (!(file instanceof File))
      return NextResponse.json(
        { message: "Selecione um arquivo." },
        { status: 400 },
      );
    const result = await uploadDocument({
      organizationId: workspace.activeOrganization.id,
      userId: workspace.user.id,
      accountPayableId:
        typeof accountPayableId === "string" && accountPayableId
          ? accountPayableId
          : null,
      paymentId: typeof paymentId === "string" && paymentId ? paymentId : null,
      attachmentType: attachmentType === "receipt" ? "receipt" : "boleto",
      file,
    });
    return NextResponse.json(
      {
        id: result.attachment.id,
        duplicate: result.duplicate,
        status: result.attachment.extraction_status,
      },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    const message =
      error instanceof InvalidDocumentError
        ? error.message
        : "Não foi possível enviar o documento.";
    return NextResponse.json(
      { message },
      { status: error instanceof InvalidDocumentError ? 400 : 500 },
    );
  }
}
