import { describe, expect, it } from "vitest";

import {
  paymentRegistrationSchema,
  paymentReversalSchema,
  paymentSettingsSchema,
} from "@/validation/payment";

describe("paymentRegistrationSchema", () => {
  it("converte valor BRL em centavos e aceita os campos obrigatórios", () => {
    const result = paymentRegistrationSchema.parse({
      accountId: "ea100000-0000-4000-8000-000000000001",
      amount: "1.234,56",
      paidAt: "2026-07-15T16:30:00.000Z",
      paymentMethod: "pix",
      bankReference: "PIX-123",
      notes: "Quitação",
      idempotencyKey: "payment-request-key-001",
      confirmOverpayment: false,
    });
    expect(result.amount).toBe(123456);
  });

  it("rejeita valor inválido", () => {
    expect(
      paymentRegistrationSchema.safeParse({
        accountId: "ea100000-0000-4000-8000-000000000001",
        amount: "12.34",
        paidAt: "2026-07-15T16:30:00.000Z",
        paymentMethod: "pix",
        bankReference: "",
        notes: "",
        idempotencyKey: "payment-request-key-001",
      }).success,
    ).toBe(false);
  });
});

describe("paymentReversalSchema", () => {
  it("exige confirmação reforçada", () => {
    expect(
      paymentReversalSchema.safeParse({
        paymentId: "ea100000-0000-4000-8000-000000000001",
        reason: "Registro incorreto",
        confirmation: "estornar",
      }).success,
    ).toBe(false);
  });
});

describe("paymentSettingsSchema", () => {
  it("aceita tolerância zero", () => {
    expect(
      paymentSettingsSchema.parse({
        allowPartialPayments: false,
        allowOverpayments: false,
        overpaymentTolerance: "0,00",
      }).overpaymentTolerance,
    ).toBe(0);
  });
});
