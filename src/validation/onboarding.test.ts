import { describe, expect, it } from "vitest";

import { onboardingSchema } from "@/validation/onboarding";

describe("onboardingSchema", () => {
  const validInput = {
    fullName: "Luiz Gomes",
    phone: "",
    legalName: "Vencii Tecnologia Ltda",
    tradeName: "Vencii",
    cnpj: "",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
  };

  it("normaliza CNPJ antes de enviar ao banco", () => {
    const result = onboardingSchema.parse({
      ...validInput,
      cnpj: "12.345.678/0001-90",
    });

    expect(result.cnpj).toBe("12345678000190");
  });

  it("rejeita fuso horário que não faz parte das preferências permitidas", () => {
    const result = onboardingSchema.safeParse({
      ...validInput,
      timezone: "UTC",
    });

    expect(result.success).toBe(false);
  });
});
