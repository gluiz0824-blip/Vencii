import { getInboundEmailEnv } from "@/config/env";
import {
  recipientLocalPart,
  SignedJsonInboundEmailProvider,
} from "@/infrastructure/email/inbound-email-provider";
import { receiveInboundEmail } from "@/services/inbound-email/inbound-email.service";

export async function POST(request: Request) {
  try {
    const env = getInboundEmailEnv();
    if (env.provider === "disabled")
      return Response.json(
        { error: "Recebimento por e-mail não configurado." },
        { status: 503 },
      );
    const provider = new SignedJsonInboundEmailProvider(
      env.provider,
      env.webhookSecret!,
      env.maxAttachments,
    );
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 30 * 1024 * 1024)
      return Response.json({ error: "Evento muito grande." }, { status: 413 });
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody) > 30 * 1024 * 1024)
      return Response.json({ error: "Evento muito grande." }, { status: 413 });
    if (
      !provider.verify({
        rawBody,
        timestamp: request.headers.get("x-vencii-timestamp"),
        signature: request.headers.get("x-vencii-signature"),
      })
    )
      return Response.json({ error: "Assinatura inválida." }, { status: 401 });
    const event = provider.parse(rawBody);
    const localPart = recipientLocalPart(event.to, env.domain);
    const result = await receiveInboundEmail({
      provider: provider.name,
      localPart,
      event,
    });
    return Response.json(
      { received: true, duplicate: result.duplicate },
      { status: result.duplicate ? 200 : 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evento inválido.";
    const notFound = /endereço de entrada inválido|inativo|destinatário/i.test(
      message,
    );
    return Response.json(
      { error: notFound ? "Destinatário não encontrado." : "Evento inválido." },
      { status: notFound ? 404 : 400 },
    );
  }
}
