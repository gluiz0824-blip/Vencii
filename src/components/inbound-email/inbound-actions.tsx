"use client";

import { useState, useTransition } from "react";
import { Check, Copy, RefreshCw, RotateCcw, Trash2 } from "lucide-react";

import {
  ignoreInboundMessageAction,
  rotateInboundAddressAction,
} from "@/app/actions/inbound-email";
import { ConfirmDialog } from "@/components/product/confirm-dialog";
import { Button } from "@/components/ui/button";

export function CopyInboundAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return (
    <Button type="button" variant="outline" onClick={copy}>
      {copied ? <Check /> : <Copy />}
      {copied ? "Copiado" : "Copiar endereço"}
    </Button>
  );
}

export function RotateInboundAddressButton() {
  const [pending, startTransition] = useTransition();
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="outline" disabled={pending}>
          <RotateCcw />
          {pending ? "Rotacionando..." : "Trocar endereço"}
        </Button>
      }
      title="Trocar o endereço de entrada?"
      description="O endereço atual será invalidado imediatamente. Mensagens futuras enviadas a ele não serão aceitas."
      confirmLabel="Trocar endereço"
      destructive
      onConfirm={() =>
        startTransition(async () => {
          await rotateInboundAddressAction();
        })
      }
    />
  );
}

export function IgnoreInboundMessageButton({
  messageId,
}: {
  messageId: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" size="sm" variant="ghost" disabled={pending}>
          <Trash2 />
          Ignorar
        </Button>
      }
      title="Ignorar esta mensagem?"
      description="Ela continuará registrada para auditoria, mas sairá do fluxo de revisão."
      confirmLabel="Ignorar mensagem"
      destructive
      onConfirm={() =>
        startTransition(async () => {
          await ignoreInboundMessageAction(messageId);
        })
      }
    />
  );
}

export function ReprocessInboundAttachmentButton({
  attachmentId,
}: {
  attachmentId: string;
}) {
  const [pending, setPending] = useState(false);
  async function reprocess() {
    setPending(true);
    try {
      const response = await fetch(`/api/attachments/${attachmentId}/process`, {
        method: "POST",
      });
      if (!response.ok) throw new Error();
      window.location.reload();
    } finally {
      setPending(false);
    }
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={reprocess}
    >
      <RefreshCw className={pending ? "animate-spin" : undefined} />
      {pending ? "Processando" : "Reprocessar"}
    </Button>
  );
}
