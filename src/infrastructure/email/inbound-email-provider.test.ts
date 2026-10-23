import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseInboundEmailEvent,
  recipientLocalPart,
  verifyInboundWebhookSignature,
} from "./inbound-email-provider";

describe("webhook de e-mail recebido", () => {
  it("rejeita webhook sem assinatura", () => {
    expect(
      verifyInboundWebhookSignature({
        rawBody: "{}",
        timestamp: null,
        signature: null,
        secret: "x".repeat(32),
      }),
    ).toBe(false);
  });
  it("aceita assinatura HMAC válida e recente", () => {
    const rawBody = "{}";
    const timestamp = "1700000000";
    const secret = "s".repeat(32);
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");
    expect(
      verifyInboundWebhookSignature({
        rawBody,
        timestamp,
        signature,
        secret,
        now: 1700000000000,
      }),
    ).toBe(true);
  });
  it("rejeita endereço previsível ou de outro domínio", () => {
    expect(() =>
      recipientLocalPart(
        "contas+empresa@entrada.localhost",
        "entrada.localhost",
      ),
    ).toThrow("inválido");
    expect(() =>
      recipientLocalPart(
        `contas+${"a".repeat(48)}@outro.test`,
        "entrada.localhost",
      ),
    ).toThrow("domínio");
  });
  it("não conserva corpo bruto e limita anexos", () => {
    const body = JSON.stringify({
      id: "evt-1",
      to: `contas+${"a".repeat(48)}@entrada.localhost`,
      from: "financeiro@empresa.test",
      subject: "Boleto",
      receivedAt: "2026-08-10T12:00:00Z",
      attachments: [],
      html: "segredo",
    });
    expect(parseInboundEmailEvent(body, 10)).not.toHaveProperty("html");
  });
});
