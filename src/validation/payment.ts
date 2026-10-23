import { z } from "zod";

import { parseBrlAmountToCents } from "@/validation/payable";

export const paymentMethodSchema = z.enum([
  "boleto",
  "pix",
  "transferencia",
  "debito_automatico",
  "cartao",
  "dinheiro",
  "outro",
]);

export const paymentRegistrationSchema = z.object({
  accountId: z.uuid(),
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,3}(?:\.\d{3})*,\d{2}$|^\d+,\d{2}$/, "Use o formato 0,00.")
    .transform(parseBrlAmountToCents),
  paidAt: z.iso.datetime({ local: true }),
  paymentMethod: paymentMethodSchema,
  bankReference: z.string().trim().max(180),
  notes: z.string().trim().max(1000),
  idempotencyKey: z.string().min(16).max(120),
  confirmOverpayment: z.boolean().default(false),
});

export const paymentReversalSchema = z.object({
  paymentId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
  confirmation: z.literal("ESTORNAR", {
    error: 'Digite "ESTORNAR" para confirmar.',
  }),
});

export const paymentSettingsSchema = z.object({
  allowPartialPayments: z.boolean(),
  allowOverpayments: z.boolean(),
  overpaymentTolerance: z
    .string()
    .trim()
    .regex(/^\d{1,3}(?:\.\d{3})*,\d{2}$|^\d+,\d{2}$/, "Use o formato 0,00.")
    .transform((value) =>
      value === "0,00" ? 0 : parseBrlAmountToCents(value),
    ),
});
