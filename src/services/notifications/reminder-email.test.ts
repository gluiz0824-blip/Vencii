import { describe, expect, it } from "vitest";

import { buildReminderEmail } from "@/services/notifications/reminder-email";

describe("template de lembrete", () => {
  it("gera conteúdo responsivo em português com link seguro", () => {
    const message = buildReminderEmail({
      recipientEmail: "financeiro@empresa.test",
      title: "Conta vence amanhã",
      body: "A conta de energia precisa de atenção.",
      path: "/app/contas-a-pagar/abc",
      appUrl: "https://vencii.test",
      idempotencyKey: "reminder-test-0001",
    });
    expect(message.subject).toBe("Conta vence amanhã | Vencii");
    expect(message.html).toContain('name="viewport"');
    expect(message.html).toContain(
      "https://vencii.test/app/contas-a-pagar/abc",
    );
    expect(message.text).toContain("não executa pagamentos");
  });

  it("remove linha digitável e escapa HTML antes do envio", () => {
    const message = buildReminderEmail({
      recipientEmail: "financeiro@empresa.test",
      title: "Alerta <urgente>",
      body: `Linha ${"1".repeat(47)}`,
      path: "/app/notificacoes",
      appUrl: "https://vencii.test",
      idempotencyKey: "reminder-test-0002",
    });
    expect(message.html).toContain("Alerta &lt;urgente&gt;");
    expect(message.html).not.toContain("1".repeat(47));
    expect(message.text).toContain("[dado protegido]");
  });

  it("não aceita destino externo no link do e-mail", () => {
    const message = buildReminderEmail({
      recipientEmail: "financeiro@empresa.test",
      title: "Atualização",
      body: "Consulte a central.",
      path: "https://site-invalido.test/coleta",
      appUrl: "https://vencii.test",
      idempotencyKey: "reminder-test-0003",
    });
    expect(message.html).toContain("https://vencii.test/app/notificacoes");
    expect(message.html).not.toContain("site-invalido.test");
  });
});
