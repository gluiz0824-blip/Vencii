import { describe, expect, it } from "vitest";

import { parseBrlAmountToCents, payableFormSchema } from "./payable";

describe("validação de contas a pagar", () => {
  it("converte BRL sem usar ponto flutuante no domínio", () => {
    expect(parseBrlAmountToCents("1.234,56")).toBe(123456);
  });

  it("rejeita emissão posterior ao vencimento", () => {
    const result = payableFormSchema.safeParse({
      supplierId: "",
      expenseCategoryId: "",
      description: "Energia elétrica",
      documentType: "boleto",
      documentNumber: "",
      barcode: "",
      pixCode: "",
      amount: "100,00",
      issueDate: "2026-08-01",
      dueDate: "2026-07-31",
      competenceDate: "",
      notes: "",
      mode: "single",
      installmentCount: 2,
      recurrenceFrequency: "monthly",
      recurrenceCount: 12,
      recurrenceEndDate: "",
      customIntervalDays: 30,
      idempotencyKey: "1234567890123456",
    });

    expect(result.success).toBe(false);
  });
});
