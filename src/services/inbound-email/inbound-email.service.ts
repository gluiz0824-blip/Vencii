import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { getDocumentMaxSizeBytes } from "@/config/env";
import {
  ATTACHMENT_BUCKET,
  extractionDataToJson,
  type AllowedDocumentMimeType,
} from "@/domain/attachments/document";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin";
import {
  decodeAttachmentBase64,
  type InboundEmailEvent,
} from "@/infrastructure/email/inbound-email-provider";
import { LocalDocumentExtractor } from "@/services/attachments/document-extractor";
import type { Database, Json } from "@/types/database";
import { validateDocumentFile } from "@/validation/attachment";

type AttachmentRow = Database["public"]["Tables"]["payable_attachments"]["Row"];

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 500)
    : "Não foi possível processar o anexo.";
}

export async function receiveInboundEmail(input: {
  provider: string;
  localPart: string;
  event: InboundEmailEvent;
}) {
  const supabase = createSupabaseAdminClient();
  const idempotencyKey = createHash("sha256")
    .update(`${input.provider}:${input.event.id}`)
    .digest("hex");
  const { data: registration, error: registerError } = await supabase.rpc(
    "register_inbound_message",
    {
      p_provider: input.provider,
      p_provider_message_id: input.event.id,
      p_local_part: input.localPart,
      p_sender_email: input.event.from,
      p_subject: input.event.subject,
      p_received_at: input.event.receivedAt,
      p_raw_metadata: {
        eventType: input.event.metadata?.eventType ?? "inbound.email",
      },
      p_idempotency_key: idempotencyKey,
    },
  );
  if (registerError) throw new Error(registerError.message);
  const registered = registration as {
    id: string;
    organization_id: string;
    duplicate: boolean;
  };
  if (registered.duplicate)
    return { messageId: registered.id, duplicate: true };

  if (input.event.attachments.length === 0) {
    await supabase
      .from("inbound_messages")
      .update({ status: "no_attachments" })
      .eq("id", registered.id);
    return { messageId: registered.id, duplicate: false };
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("owner_id")
    .eq("id", registered.organization_id)
    .single();
  if (organizationError)
    throw new Error(
      "Não foi possível identificar o responsável pela organização.",
    );

  let reviewable = false;
  for (const incoming of input.event.attachments) {
    try {
      const bytes = decodeAttachmentBase64(incoming.contentBase64);
      const validated = validateDocumentFile({
        name: incoming.name,
        claimedMime: incoming.contentType,
        bytes,
        maximumBytes: getDocumentMaxSizeBytes(),
      });
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const { data: duplicate } = await supabase
        .from("payable_attachments")
        .select("*")
        .eq("organization_id", registered.organization_id)
        .eq("sha256", sha256)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (duplicate) {
        await linkInboundAttachment({
          messageId: registered.id,
          organizationId: registered.organization_id,
          providerAttachmentId: incoming.id,
          originalName: validated.originalName,
          attachmentId: duplicate.id,
          status: "duplicate",
        });
        reviewable = true;
        continue;
      }

      const storagePath = `${registered.organization_id}/unassigned/${randomUUID()}.${validated.extension}`;
      const attachmentId = randomUUID();
      const { data: attachment, error: insertError } = await supabase
        .from("payable_attachments")
        .insert({
          id: attachmentId,
          organization_id: registered.organization_id,
          account_payable_id: null,
          payment_id: null,
          storage_path: storagePath,
          original_name: validated.originalName,
          mime_type: validated.mimeType,
          size_bytes: bytes.length,
          sha256,
          attachment_type: "boleto",
          uploaded_by: organization.owner_id,
          extraction_status: "processing",
          processing_attempts: 1,
        })
        .select("*")
        .single();
      if (insertError) throw new Error(insertError.message);
      await linkInboundAttachment({
        messageId: registered.id,
        organizationId: registered.organization_id,
        providerAttachmentId: incoming.id,
        originalName: validated.originalName,
        attachmentId,
        status: "processing",
      });
      const { error: storageError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(storagePath, bytes, {
          contentType: validated.mimeType,
          upsert: false,
        });
      if (storageError)
        throw new Error("Não foi possível armazenar o documento.");
      reviewable =
        (await extractInboundAttachment(attachment, bytes)) || reviewable;
    } catch (error) {
      await linkInboundAttachment({
        messageId: registered.id,
        organizationId: registered.organization_id,
        providerAttachmentId: incoming.id,
        originalName: incoming.name.slice(0, 255) || "anexo",
        attachmentId: null,
        status: "failed",
        error: errorMessage(error),
      });
    }
  }
  await supabase
    .from("inbound_messages")
    .update({
      status: reviewable ? "needs_review" : "failed",
      error_message: reviewable
        ? null
        : "Nenhum anexo permitido pôde ser processado.",
    })
    .eq("id", registered.id);
  return { messageId: registered.id, duplicate: false };
}

async function linkInboundAttachment(input: {
  messageId: string;
  organizationId: string;
  providerAttachmentId: string;
  originalName: string;
  attachmentId: string | null;
  status: "processing" | "duplicate" | "failed";
  error?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("inbound_message_attachments").upsert(
    {
      organization_id: input.organizationId,
      inbound_message_id: input.messageId,
      provider_attachment_id: input.providerAttachmentId,
      original_name: input.originalName,
      attachment_id: input.attachmentId,
      processing_status: input.status,
      error_message: input.error ?? null,
    },
    {
      onConflict: "inbound_message_id,provider_attachment_id",
      ignoreDuplicates: true,
    },
  );
  if (error) throw new Error(error.message);
}

async function extractInboundAttachment(
  attachment: AttachmentRow,
  bytes: Uint8Array,
) {
  const supabase = createSupabaseAdminClient();
  try {
    const data = await new LocalDocumentExtractor().extract(
      bytes,
      attachment.mime_type as AllowedDocumentMimeType,
    );
    await supabase
      .from("payable_attachments")
      .update({
        extraction_status: "needs_review",
        extraction_data: extractionDataToJson(data),
        last_error: null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", attachment.id);
    return true;
  } catch {
    await supabase
      .from("payable_attachments")
      .update({
        extraction_status: "failed",
        extraction_data: {} as Json,
        last_error:
          "Não foi possível extrair este documento. Faça a revisão manual.",
        processed_at: new Date().toISOString(),
      })
      .eq("id", attachment.id);
    return false;
  }
}
