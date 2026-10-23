import { z } from "zod";

import { parseBrlAmountToCents } from "@/validation/payable";

function optionalAmount(value: string): number | null {
  const normalized = value.trim();
  return normalized ? parseBrlAmountToCents(normalized) : null;
}

export const approvalRuleFormSchema = z
  .object({
    name: z.string().trim().min(2, "Informe um nome para a regra.").max(120),
    minAmount: z.string().max(32),
    maxAmount: z.string().max(32),
    categoryId: z.union([z.literal(""), z.uuid()]),
    supplierId: z.union([z.literal(""), z.uuid()]),
    requiredApprovals: z.coerce.number().int().min(1).max(10),
    priority: z.coerce.number().int().min(0).max(1000),
  })
  .transform((value, context) => {
    let minAmountCents: number | null = null;
    let maxAmountCents: number | null = null;
    try {
      minAmountCents = optionalAmount(value.minAmount);
      maxAmountCents = optionalAmount(value.maxAmount);
    } catch {
      context.addIssue({
        code: "custom",
        path: ["minAmount"],
        message: "Informe uma faixa de valor válida.",
      });
      return z.NEVER;
    }
    if (
      minAmountCents !== null &&
      maxAmountCents !== null &&
      minAmountCents > maxAmountCents
    ) {
      context.addIssue({
        code: "custom",
        path: ["maxAmount"],
        message: "O valor máximo deve ser maior ou igual ao mínimo.",
      });
      return z.NEVER;
    }
    return {
      name: value.name,
      minAmountCents,
      maxAmountCents,
      categoryId: value.categoryId || null,
      supplierId: value.supplierId || null,
      requiredApprovals: value.requiredApprovals,
      priority: value.priority,
    };
  });

export const approvalDecisionSchema = z
  .object({
    requestId: z.uuid(),
    decision: z.enum(["approved", "rejected"]),
    comment: z.string().trim().max(1000),
  })
  .superRefine((value, context) => {
    if (value.decision === "rejected" && value.comment.length < 3) {
      context.addIssue({
        code: "custom",
        path: ["comment"],
        message: "A rejeição exige uma justificativa.",
      });
    }
  });

export const batchApprovalSchema = z.object({
  requestIds: z.array(z.uuid()).min(1).max(100),
  comment: z.string().trim().max(1000),
});
