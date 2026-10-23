import type { EmailMessage } from "@/infrastructure/email/email-provider";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function redactSensitive(value: string): string {
  return value
    .replace(/(?:\d[ .-]?){32,}/g, "[dado protegido]")
    .replace(/000201[A-Za-z0-9 .:/_-]{20,}/g, "[código Pix protegido]");
}

export function buildReminderEmail(input: {
  recipientEmail: string;
  title: string;
  body: string;
  path: string;
  appUrl: string;
  idempotencyKey: string;
}): EmailMessage {
  const safePath = /^\/app(?:\/|$)/.test(input.path)
    ? input.path
    : "/app/notificacoes";
  const url = new URL(safePath, input.appUrl).toString();
  const safeTitleText = redactSensitive(input.title);
  const safeBodyText = redactSensitive(input.body);
  const title = escapeHtml(safeTitleText);
  const body = escapeHtml(safeBodyText);
  const safeUrl = escapeHtml(url);
  return {
    to: input.recipientEmail,
    subject: `${safeTitleText} | Vencii`,
    idempotencyKey: input.idempotencyKey,
    text: `${safeTitleText}\n\n${safeBodyText}\n\nAcesse com segurança: ${url}\n\nA Vencii não executa pagamentos.`,
    html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#10213d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #dce3ed;border-radius:12px"><tr><td style="padding:28px"><div style="font-size:20px;font-weight:700;color:#075dcc">Vencii</div><h1 style="font-size:22px;line-height:1.3;margin:28px 0 10px">${title}</h1><p style="font-size:15px;line-height:1.6;color:#526077;margin:0 0 24px">${body}</p><a href="${safeUrl}" style="display:inline-block;background:#075dcc;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">Abrir na Vencii</a><p style="font-size:12px;line-height:1.5;color:#7a8799;margin:28px 0 0">Por segurança, dados completos do documento e a linha digitável não são enviados por e-mail. A Vencii organiza pagamentos e não movimenta dinheiro.</p></td></tr></table></td></tr></table></body></html>`,
  };
}
