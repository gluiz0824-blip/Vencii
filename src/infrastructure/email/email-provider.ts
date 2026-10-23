import { randomUUID } from "node:crypto";

import { getEmailEnv } from "@/config/env";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}

export interface EmailSendResult {
  messageId: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export interface FutureChannelProvider<TMessage> {
  readonly channel: "whatsapp";
  readonly configured: boolean;
  send(message: TMessage): Promise<{ messageId: string }>;
}

export class LocalEmailProvider implements EmailProvider {
  async send(): Promise<EmailSendResult> {
    return { messageId: `local-${randomUUID()}` };
  }
}

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    const result = (await response.json().catch(() => null)) as {
      id?: string;
      name?: string;
    } | null;
    if (!response.ok || !result?.id)
      throw new EmailProviderError(result?.name ?? `http_${response.status}`);
    return { messageId: result.id };
  }
}

export class EmailProviderError extends Error {
  constructor(readonly code: string) {
    super("O provedor de e-mail não concluiu o envio.");
  }
}

export function getEmailProvider(): EmailProvider {
  const env = getEmailEnv();
  return env.provider === "resend"
    ? new ResendEmailProvider(env.apiKey!, env.from)
    : new LocalEmailProvider();
}
