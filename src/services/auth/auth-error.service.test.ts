import { describe, expect, it } from "vitest";

import { getSignUpErrorMessage } from "@/services/auth/auth-error.service";

describe("getSignUpErrorMessage", () => {
  it("explica limites de envio sem expor detalhes internos", () => {
    expect(
      getSignUpErrorMessage({
        code: "over_email_send_rate_limit",
        status: 429,
      }),
    ).toContain("Muitos e-mails");
  });

  it("orienta verificar banco quando o Auth devolve erro interno", () => {
    expect(getSignUpErrorMessage({ status: 500 })).toContain("migrations");
  });

  it("mantém mensagem segura para códigos desconhecidos", () => {
    expect(getSignUpErrorMessage({ code: "unknown" })).not.toContain("unknown");
  });
});
