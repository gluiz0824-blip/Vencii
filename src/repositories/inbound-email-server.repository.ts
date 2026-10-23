import "server-only";

import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import type {
  InboundAttachmentStatus,
  InboundMessageStatus,
} from "@/types/database";

export interface InboundAttachmentItem {
  id: string;
  attachmentId: string | null;
  originalName: string;
  status: InboundAttachmentStatus;
  errorMessage: string | null;
}

export interface InboundMessageItem {
  id: string;
  senderEmail: string;
  subject: string;
  receivedAt: string;
  status: InboundMessageStatus;
  errorMessage: string | null;
  attachments: InboundAttachmentItem[];
}

export async function getActiveInboundAddress(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("inbound_addresses")
    .select("local_part")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .maybeSingle();
  if (error)
    throw new Error("Não foi possível carregar o endereço de entrada.");
  return data?.local_part ?? null;
}

export async function listInboundMessages(
  organizationId: string,
): Promise<InboundMessageItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("inbound_messages")
    .select("id,sender_email,subject,received_at,status,error_message")
    .eq("organization_id", organizationId)
    .order("received_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Não foi possível carregar a caixa de entrada.");
  const ids = (data ?? []).map((message) => message.id);
  const { data: attachments, error: attachmentError } = ids.length
    ? await supabase
        .from("inbound_message_attachments")
        .select(
          "id,inbound_message_id,attachment_id,original_name,processing_status,error_message",
        )
        .in("inbound_message_id", ids)
        .order("created_at")
    : { data: [], error: null };
  if (attachmentError)
    throw new Error("Não foi possível carregar os anexos recebidos.");
  return (data ?? []).map((message) => ({
    id: message.id,
    senderEmail: message.sender_email,
    subject: message.subject,
    receivedAt: message.received_at,
    status: message.status,
    errorMessage: message.error_message,
    attachments: (attachments ?? [])
      .filter((attachment) => attachment.inbound_message_id === message.id)
      .map((attachment) => ({
        id: attachment.id,
        attachmentId: attachment.attachment_id,
        originalName: attachment.original_name,
        status: attachment.processing_status,
        errorMessage: attachment.error_message,
      })),
  }));
}

export async function rotateInboundAddress(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rotate_inbound_address", {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function ignoreInboundMessage(
  organizationId: string,
  messageId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("ignore_inbound_message", {
    p_organization_id: organizationId,
    p_message_id: messageId,
  });
  if (error) throw new Error(error.message);
}

export async function isInboundAttachment(
  organizationId: string,
  attachmentId: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("inbound_message_attachments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("attachment_id", attachmentId)
    .limit(1)
    .maybeSingle();
  if (error)
    throw new Error("Não foi possível identificar a origem do documento.");
  return Boolean(data);
}
