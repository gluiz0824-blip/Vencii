import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AttachmentReviewForm } from "@/components/attachments/attachment-review-form";
import { PageHeader } from "@/components/product/page-header";
import { requireWorkspace } from "@/dal/workspace";
import type { DocumentExtractionData } from "@/domain/attachments/document";
import { listAccountsPayable } from "@/repositories/accounts-payable-server.repository";
import {
  createAttachmentSignedUrl,
  findAttachment,
} from "@/repositories/attachment-server.repository";

export const metadata: Metadata = { title: "Revisar documento" };

function extraction(value: unknown): DocumentExtractionData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    (item.version !== 1 && item.version !== 2) ||
    typeof item.candidates !== "object"
  )
    return null;
  return value as DocumentExtractionData;
}

export default async function AttachmentReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ duplicate?: string }>;
}) {
  const [workspace, { id }, query] = await Promise.all([
    requireWorkspace(),
    params,
    searchParams,
  ]);
  const attachment = await findAttachment(workspace.activeOrganization.id, id);
  if (!attachment) notFound();
  const [previewUrl, accounts] = await Promise.all([
    createAttachmentSignedUrl(attachment, 180),
    listAccountsPayable(workspace.activeOrganization.id, {
      page: 1,
      pageSize: 100,
      direction: "desc",
    }),
  ]);
  return (
    <section className="app-page space-y-[var(--space-section)]">
      <PageHeader
        title="Revisar documento"
        description="Compare o arquivo com os dados sugeridos e corrija qualquer informação antes de salvar."
        breadcrumbs={[
          { label: "Contas a pagar", href: "/app/contas-a-pagar" },
          { label: "Revisar documento" },
        ]}
      />
      <AttachmentReviewForm
        attachmentId={attachment.id}
        originalName={attachment.original_name}
        mimeType={attachment.mime_type}
        previewUrl={previewUrl}
        extraction={extraction(attachment.extraction_data)}
        accounts={accounts.items.map((account) => ({
          id: account.id,
          description: account.description,
          dueDate: account.due_date,
        }))}
        duplicate={query.duplicate === "1"}
        extractionFailed={attachment.extraction_status === "failed"}
        extractionOutdated={
          extraction(attachment.extraction_data)?.version === 1
        }
      />
    </section>
  );
}
