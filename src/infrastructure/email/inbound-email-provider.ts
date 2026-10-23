import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const attachmentSchema = z.object({
  id: z.string().trim().min(1).max(255),
  name: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(100),
  contentBase64: z.string().min(4),
});

const eventSchema = z.object({
  id: z.string().trim().min(1).max(255),
  to: z.string().trim().email().max(320),
  from: z.string().trim().email().max(320),
  subject: z.string().trim().max(300).default("(sem assunto)"),
  receivedAt: z.iso.datetime({ offset: true }),
  attachments: z.array(attachmentSchema),
  metadata: z
    .object({ eventType: z.string().trim().max(80).optional() })
    .optional(),
});

export type InboundEmailEvent = z.infer<typeof eventSchema>;

export interface InboundEmailProviderAdapter {
  readonly name: string;
  verify(input: {
    rawBody: string;
    timestamp: string | null;
    signature: string | null;
  }): boolean;
  parse(rawBody: string): InboundEmailEvent;
}

export class SignedJsonInboundEmailProvider implements InboundEmailProviderAdapter {
  constructor(
    public readonly name: string,
    private readonly secret: string,
    private readonly maximumAttachments: number,
  ) {}

  verify(input: {
    rawBody: string;
    timestamp: string | null;
    signature: string | null;
  }): boolean {
    return verifyInboundWebhookSignature({ ...input, secret: this.secret });
  }

  parse(rawBody: string): InboundEmailEvent {
    return parseInboundEmailEvent(rawBody, this.maximumAttachments);
  }
}

export function verifyInboundWebhookSignature(input: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  now?: number;
}): boolean {
  if (!input.timestamp || !input.signature) return false;
  const timestamp = Number(input.timestamp);
  const now = input.now ?? Date.now();
  if (
    !Number.isInteger(timestamp) ||
    Math.abs(now - timestamp * 1000) > 300_000
  )
    return false;
  const provided = input.signature.replace(/^sha256=/, "");
  if (!/^[0-9a-f]{64}$/i.test(provided)) return false;
  const expected = createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest("hex");
  return timingSafeEqual(
    Buffer.from(provided, "hex"),
    Buffer.from(expected, "hex"),
  );
}

export function parseInboundEmailEvent(
  rawBody: string,
  maximumAttachments: number,
): InboundEmailEvent {
  const parsed = eventSchema.parse(JSON.parse(rawBody));
  if (parsed.attachments.length > maximumAttachments)
    throw new Error(
      `O e-mail excede o limite de ${maximumAttachments} anexos.`,
    );
  return {
    ...parsed,
    subject:
      parsed.subject.replace(/[\u0000-\u001f\u007f]/g, " ").trim() ||
      "(sem assunto)",
  };
}

export function recipientLocalPart(
  recipient: string,
  expectedDomain: string,
): string {
  const splitAt = recipient.lastIndexOf("@");
  if (splitAt <= 0) throw new Error("Destinatário inválido.");
  const localPart = recipient.slice(0, splitAt).toLowerCase();
  const domain = recipient.slice(splitAt + 1).toLowerCase();
  if (domain !== expectedDomain.toLowerCase())
    throw new Error("O destinatário não pertence ao domínio configurado.");
  if (!/^contas\+[0-9a-f]{48}$/.test(localPart))
    throw new Error("Endereço de entrada inválido.");
  return localPart;
}

export function decodeAttachmentBase64(value: string): Uint8Array {
  const compact = value.replace(/\s/g, "");
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      compact,
    )
  )
    throw new Error("Conteúdo do anexo corrompido.");
  const buffer = Buffer.from(compact, "base64");
  if (
    !buffer.length ||
    buffer.toString("base64").replace(/=+$/, "") !== compact.replace(/=+$/, "")
  )
    throw new Error("Conteúdo do anexo corrompido.");
  return new Uint8Array(buffer);
}
