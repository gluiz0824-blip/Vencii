import { describe, expect, it } from "vitest";

import { notificationHref } from "@/domain/notifications/notification";

describe("destino de notificações", () => {
  it("abre detalhes de contas e a caixa de aprovações", () => {
    expect(
      notificationHref({ type: "payable_due_today", entityId: "payable-1" }),
    ).toBe("/app/contas-a-pagar/payable-1");
    expect(
      notificationHref({ type: "approval_requested", entityId: "request-1" }),
    ).toBe("/app/aprovacoes");
  });
});
