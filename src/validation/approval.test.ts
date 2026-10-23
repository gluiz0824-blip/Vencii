import { describe, expect, it } from "vitest";

import { approvalDecisionSchema, approvalRuleFormSchema } from "./approval";

describe("validação de aprovações", () => {
  it("converte faixa monetária em centavos", () => {
    const result = approvalRuleFormSchema.parse({
      name: "Contas relevantes",
      minAmount: "1.250,50",
      maxAmount: "5.000,00",
      categoryId: "",
      supplierId: "",
      requiredApprovals: "2",
      priority: "10",
    });
    expect(result.minAmountCents).toBe(125_050);
    expect(result.maxAmountCents).toBe(500_000);
    expect(result.requiredApprovals).toBe(2);
  });

  it("bloqueia faixa invertida", () => {
    expect(() =>
      approvalRuleFormSchema.parse({
        name: "Faixa inválida",
        minAmount: "500,00",
        maxAmount: "100,00",
        categoryId: "",
        supplierId: "",
        requiredApprovals: "1",
        priority: "0",
      }),
    ).toThrow();
  });

  it("exige justificativa para rejeição", () => {
    const result = approvalDecisionSchema.safeParse({
      requestId: "6c000000-0000-4000-8000-000000000001",
      decision: "rejected",
      comment: "",
    });
    expect(result.success).toBe(false);
  });
});
