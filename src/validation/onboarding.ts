import { z } from "zod";

export const onboardingProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo.").max(160),
  phone: z
    .string()
    .trim()
    .max(32, "Telefone muito longo.")
    .optional()
    .default(""),
});

export const onboardingOrganizationSchema = z.object({
  legalName: z.string().trim().min(2, "Informe a razão social.").max(180),
  tradeName: z.string().trim().min(2, "Informe o nome fantasia.").max(120),
  cnpj: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine(
      (value) => value === "" || value.length === 14,
      "O CNPJ deve ter 14 dígitos.",
    ),
});

export const onboardingPreferencesSchema = z.object({
  timezone: z.enum([
    "America/Sao_Paulo",
    "America/Manaus",
    "America/Recife",
    "America/Fortaleza",
  ]),
  currency: z.literal("BRL"),
});

export const onboardingSchema = onboardingProfileSchema
  .and(onboardingOrganizationSchema)
  .and(onboardingPreferencesSchema);

export type OnboardingData = z.input<typeof onboardingSchema>;
