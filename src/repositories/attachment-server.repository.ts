import "server-only";

import { ATTACHMENT_BUCKET } from "@/domain/attachments/document";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import type { Database, Json } from "@/types/database";

export type AttachmentRow =
  Database["public"]["Tables"]["payable_attachments"]["Row"];
type AttachmentInsert =
  Database["public"]["Tables"]["payable_attachments"]["Insert"];

export async function findAttachmentByHash(
  organizationId: string,
  sha256: string,
): Promise<AttachmentRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payable_attachments")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("sha256", sha256)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error)
    throw new Error("Não foi possível verificar documentos duplicados.");
  return data;
}

export async function insertAttachment(
  values: AttachmentInsert,
): Promise<AttachmentRow> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payable_attachments")
    .insert(values)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function uploadAttachmentObject(
  path: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, bytes, { contentType: mimeType, upsert: false });
  if (error) throw new Error("Não foi possível armazenar o documento.");
}

export async function deleteAttachment(
  attachment: AttachmentRow,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .remove([attachment.storage_path]);
  await supabase.from("payable_attachments").delete().eq("id", attachment.id);
}

export async function findAttachment(
  organizationId: string,
  attachmentId: string,
): Promise<AttachmentRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payable_attachments")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", attachmentId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar o documento.");
  return data;
}

export async function listAccountAttachments(
  organizationId: string,
  accountId: string,
): Promise<AttachmentRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payable_attachments")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("account_payable_id", accountId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Não foi possível carregar os anexos da conta.");
  return data ?? [];
}

export async function downloadAttachment(
  attachment: AttachmentRow,
): Promise<Uint8Array> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .download(attachment.storage_path);
  if (error) throw new Error("Não foi possível ler o documento armazenado.");
  return new Uint8Array(await data.arrayBuffer());
}

export async function createAttachmentSignedUrl(
  attachment: AttachmentRow,
  expiresInSeconds = 180,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(attachment.storage_path, expiresInSeconds);
  if (error) throw new Error("Não foi possível gerar a visualização segura.");
  return data.signedUrl;
}

export async function claimAttachment(
  organizationId: string,
  attachmentId: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("claim_attachment_extraction", {
    p_organization_id: organizationId,
    p_attachment_id: attachmentId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function finishAttachment(input: {
  organizationId: string;
  attachmentId: string;
  status: "needs_review" | "failed";
  data: Json;
  error?: string;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("finish_attachment_extraction", {
    p_organization_id: input.organizationId,
    p_attachment_id: input.attachmentId,
    p_status: input.status,
    p_extraction_data: input.data,
    p_error: input.error ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function reviewAttachment(input: {
  organizationId: string;
  attachmentId: string;
  accountPayableId: string | null;
  data: Json;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("review_payable_attachment", {
    p_organization_id: input.organizationId,
    p_attachment_id: input.attachmentId,
    p_account_payable_id: input.accountPayableId,
    p_review_data: input.data,
  });
  if (error) throw new Error(error.message);
}
