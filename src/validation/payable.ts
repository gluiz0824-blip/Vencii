import { z } from "zod";

import { businessDate } from "@/domain/shared/business-date";

const optionalUuid = z.union([z.literal(""), z.uuid()]);
const optionalDate = z.union([z.literal(""), z.iso.date()]);
const optionalText = (maximum: number) => z.string().trim().max(maximum);

const payableFieldsSchema = z.object({
  supplierId: optionalUuid,
  expenseCategoryId: optionalUuid,
  description: z.string().trim().min(2).max(240),
  documentType: z.enum([
    "boleto",
    "pix",
    "transferencia",
    "cartao",
    "imposto",
    "outro",
  ]),
  documentNumber: optionalText(120),
  barcode: optionalText(160),
  pixCode: optionalText(1000),
  amount: z
    .string()
    .trim()
    .min(1, "Informe o valor.")
    .regex(/^\d{1,3}(?:\.\d{3})*,\d{2}$|^\d+,\d{2}$/, "Use o formato 0,00."),
  issueDate: optionalDate,
  dueDate: z.iso.date("Informe uma data de vencimento válida."),
  competenceDate: optionalDate,
  notes: optionalText(4000),
  mode: z.enum(["single", "installments", "recurring"]),
  installmentCount: z.number().int().min(2).max(360),
  recurrenceFrequency: z.enum(["weekly", "monthly", "yearly", "custom"]),
  recurrenceCount: z.number().int().min(1).max(360),
  recurrenceEndDate: optionalDate,
  customIntervalDays: z.number().int().min(1).max(365),
  idempotencyKey: z.string().min(16).max(120),
});

export const payableFormSchema = payableFieldsSchema.superRefine(
  (data, context) => {
    try {
      const dueDate = businessDate(data.dueDate);
      if (data.issueDate && businessDate(data.issueDate) > dueDate) {
        context.addIssue({
          code: "custom",
          path: ["issueDate"],
          message: "A emissão não pode ser posterior ao vencimento.",
        });
      }
      if (
        data.mode === "recurring" &&
        data.recurrenceEndDate &&
        businessDate(data.recurrenceEndDate) < dueDate
      ) {
        context.addIssue({
          code: "custom",
          path: ["recurrenceEndDate"],
          message:
            "A data final deve ser igual ou posterior ao primeiro vencimento.",
        });
      }
    } catch {
      context.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Informe uma data de vencimento válida.",
      });
    }
  },
);

export type PayableFormValues = z.infer<typeof payableFormSchema>;

export const payableUpdateSchema = payableFieldsSchema
  .omit({
    mode: true,
    installmentCount: true,
    recurrenceFrequency: true,
    recurrenceCount: true,
    recurrenceEndDate: true,
    customIntervalDays: true,
    idempotencyKey: true,
  })
  .superRefine((data, context) => {
    if (data.issueDate && data.issueDate > data.dueDate) {
      context.addIssue({
        code: "custom",
        path: ["issueDate"],
        message: "A emissão não pode ser posterior ao vencimento.",
      });
    }
  });

export function parseBrlAmountToCents(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new TypeError("Valor monetário inválido.");
  }
  return cents;
}

export const paymentRegistrationSchema = z.object({
  paidDate: z.iso.date("Informe uma data de pagamento válida."),
  notes: z.string().trim().max(1000),
});
