import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Inbox,
  Mail,
  Paperclip,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  CopyInboundAddress,
  IgnoreInboundMessageButton,
  ReprocessInboundAttachmentButton,
  RotateInboundAddressButton,
} from "@/components/inbound-email/inbound-actions";
import { EmptyState } from "@/components/product/empty-state";
import { PageHeader } from "@/components/product/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getInboundEmailDomain } from "@/config/env";
import { requireWorkspace } from "@/dal/workspace";
import {
  getActiveInboundAddress,
  listInboundMessages,
} from "@/repositories/inbound-email-server.repository";
import type {
  InboundAttachmentStatus,
  InboundMessageStatus,
} from "@/types/database";

export const metadata: Metadata = { title: "Caixa de entrada" };

const messageLabels: Record<InboundMessageStatus, string> = {
  received: "Recebida",
  processing: "Processando",
  needs_review: "Aguardando revisão",
  completed: "Concluída",
  failed: "Falhou",
  ignored: "Ignorada",
  no_attachments: "Sem anexos",
};
const attachmentLabels: Record<InboundAttachmentStatus, string> = {
  pending: "Pendente",
  processing: "Processando",
  needs_review: "Revisar",
  completed: "Concluído",
  failed: "Falhou",
  duplicate: "Possível duplicidade",
  ignored: "Ignorado",
};

function badgeVariant(status: InboundMessageStatus | InboundAttachmentStatus) {
  return status === "failed"
    ? ("destructive" as const)
    : status === "completed"
      ? ("default" as const)
      : ("outline" as const);
}

export default async function InboundInboxPage() {
  const workspace = await requireWorkspace();
  const [localPart, messages] = await Promise.all([
    getActiveInboundAddress(workspace.activeOrganization.id),
    listInboundMessages(workspace.activeOrganization.id),
  ]);
  const address = localPart ? `${localPart}@${getInboundEmailDomain()}` : null;
  const canRotate = ["owner", "admin"].includes(
    workspace.activeOrganization.role,
  );
  const canManage = ["owner", "admin", "operator"].includes(
    workspace.activeOrganization.role,
  );

  return (
    <section className="app-page space-y-[var(--space-section)]">
      <PageHeader
        title="Caixa de entrada"
        description="Encaminhe boletos e cobranças para análise e confirme os dados antes de criar uma conta."
        breadcrumbs={[{ label: "Caixa de entrada" }]}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="text-primary size-5" />
            Endereço exclusivo da organização
          </CardTitle>
          <CardDescription>
            Somente anexos permitidos são armazenados. O remetente não recebe
            acesso à empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {address ? (
            <>
              <div className="bg-muted/50 flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                <code className="text-sm font-semibold break-all">
                  {address}
                </code>
                <div className="flex flex-wrap gap-2">
                  <CopyInboundAddress address={address} />
                  {canRotate && <RotateInboundAddressButton />}
                </div>
              </div>
              <div className="text-muted-foreground grid gap-2 text-sm md:grid-cols-3">
                <p className="flex gap-2">
                  <Paperclip className="mt-0.5 size-4 shrink-0" />
                  PDF, PNG e JPEG, até{" "}
                  {process.env.DOCUMENT_MAX_SIZE_MB ?? "10"} MB por arquivo.
                </p>
                <p className="flex gap-2">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                  Documentos ficam em armazenamento privado.
                </p>
                <p className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  Nenhuma conta é criada sem revisão.
                </p>
              </div>
            </>
          ) : (
            <p className="text-destructive">
              O endereço ainda não foi provisionado. Aplique as migrations mais
              recentes.
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="font-heading text-lg font-semibold">
          Mensagens recebidas
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          As 50 mensagens mais recentes da organização ativa.
        </p>
      </div>
      {messages.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nenhuma mensagem recebida"
          description="Envie um boleto para o endereço acima. Ele aparecerá aqui após a validação do webhook."
        />
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <Card key={message.id}>
              <CardHeader className="border-b">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>{message.subject}</CardTitle>
                    <CardDescription className="mt-1">
                      De {message.senderEmail} ·{" "}
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(message.receivedAt))}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={badgeVariant(message.status)}>
                      {messageLabels[message.status]}
                    </Badge>
                    {canManage &&
                      !["completed", "ignored"].includes(message.status) && (
                        <IgnoreInboundMessageButton messageId={message.id} />
                      )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {message.status === "no_attachments" && (
                  <p className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="size-4 text-amber-600" />A
                    mensagem não continha anexos.
                  </p>
                )}
                {message.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {attachment.originalName}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={badgeVariant(attachment.status)}>
                          {attachmentLabels[attachment.status]}
                        </Badge>
                        {attachment.errorMessage && (
                          <span className="text-destructive text-xs">
                            {attachment.errorMessage}
                          </span>
                        )}
                      </div>
                    </div>
                    {attachment.attachmentId && canManage && (
                      <div className="flex shrink-0 gap-2">
                        {attachment.status === "failed" && (
                          <ReprocessInboundAttachmentButton
                            attachmentId={attachment.attachmentId}
                          />
                        )}
                        <Button asChild size="sm">
                          <Link
                            href={`/app/contas-a-pagar/anexos/${attachment.attachmentId}/revisar`}
                          >
                            {attachment.status === "completed"
                              ? "Ver documento"
                              : "Revisar"}
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {message.status === "processing" && (
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Clock3 className="size-4 animate-pulse" />
                    Processando anexos...
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
