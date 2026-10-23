import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { getDocumentMaxSizeBytes } from "@/config/env";
import {
  extractionDataToJson,
  type AllowedDocumentMimeType,
} from "@/domain/attachments/document";
import {
  claimAttachment,
  deleteAttachment,
  downloadAttachment,
  findAttachment,
  findAttachmentByHash,
  finishAttachment,
  insertAttachment,
  uploadAttachmentObject,
} from "@/repositories/attachment-server.repository";
import { LocalDocumentExtractor } from "@/services/attachments/document-extractor";
import { validateDocumentFile } from "@/validation/attachment";

export async function uploadDocument(input: {
  organizationId: string;
  userId: string;
  accountPayableId?: string | null;
  paymentId?: string | null;
  attachmentType?: "boleto" | "receipt";
  file: File;
}) {
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const validated = validateDocumentFile({
    name: input.file.name,
    claimedMime: input.file.type,
    bytes,
    maximumBytes: getDocumentMaxSizeBytes(),
  });
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const duplicate = await findAttachmentByHash(input.organizationId, sha256);
  if (duplicate)
    return { attachment: duplicate, duplicate: true, uploaded: false };

  const id = randomUUID();
  const accountPart = input.accountPayableId ?? "unassigned";
  const storagePath = `${input.organizationId}/${accountPart}/${randomUUID()}.${validated.extension}`;
  const attachment = await insertAttachment({
    id,
    organization_id: input.organizationId,
    account_payable_id: input.accountPayableId ?? null,
    payment_id: input.paymentId ?? null,
    storage_path: storagePath,
    original_name: validated.originalName,
    mime_type: validated.mimeType,
    size_bytes: bytes.length,
    sha256,
    attachment_type: input.attachmentType ?? "boleto",
    uploaded_by: input.userId,
  });
  try {
    await uploadAttachmentObject(storagePath, bytes, validated.mimeType);
  } catch (error) {
    await deleteAttachment(attachment);
    throw error;
  }
  return { attachment, duplicate: false, uploaded: true };
}

export async function processDocument(
  organizationId: string,
  attachmentId: string,
) {
  const attachment = await findAttachment(organizationId, attachmentId);
  if (!attachment) throw new Error("Documento não encontrado.");
  const extraction =
    attachment.extraction_data &&
    typeof attachment.extraction_data === "object" &&
    !Array.isArray(attachment.extraction_data)
      ? attachment.extraction_data
      : null;
  const extractionVersion =
    extraction && typeof extraction.version === "number"
      ? extraction.version
      : 0;
  if (
    attachment.extraction_status === "completed" ||
    (attachment.extraction_status === "needs_review" && extractionVersion >= 2)
  )
    return attachment;
  const claimed = await claimAttachment(organizationId, attachmentId);
  if (!claimed) {
    if (attachment.extraction_status === "processing") return attachment;
    throw new Error("O limite de tentativas de extração foi atingido.");
  }
  try {
    const bytes = await downloadAttachment(attachment);
    const extractor = new LocalDocumentExtractor();
    const data = await extractor.extract(
      bytes,
      attachment.mime_type as AllowedDocumentMimeType,
    );
    await finishAttachment({
      organizationId,
      attachmentId,
      status: "needs_review",
      data: extractionDataToJson(data),
    });
  } catch {
    await finishAttachment({
      organizationId,
      attachmentId,
      status: "failed",
      data: {},
      error:
        "Não foi possível extrair este documento. Você ainda pode preencher os dados manualmente.",
    });
  }
  return findAttachment(organizationId, attachmentId);
}
