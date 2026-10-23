import { z } from "zod";

const supabaseEnvSchema = z.object({
  url: z.url("NEXT_PUBLIC_SUPABASE_URL deve ser uma URL válida."),
  publishableKey: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY é obrigatória."),
});

export type SupabasePublicEnv = z.infer<typeof supabaseEnvSchema>;

const appUrlSchema = z.url("NEXT_PUBLIC_APP_URL deve ser uma URL válida.");
const documentMaxSizeSchema = z.coerce.number().int().min(1).max(10);
const serverSecretsSchema = z.object({
  serviceRoleKey: z
    .string()
    .min(20, "SUPABASE_SERVICE_ROLE_KEY é obrigatória para jobs."),
  cronSecret: z
    .string()
    .min(32, "CRON_SECRET deve ter ao menos 32 caracteres."),
});
const emailEnvSchema = z
  .object({
    provider: z.enum(["local", "resend"]),
    apiKey: z.string().optional(),
    from: z.string().min(3),
  })
  .superRefine((value, context) => {
    if (value.provider === "resend" && !value.apiKey)
      context.addIssue({
        code: "custom",
        path: ["apiKey"],
        message: "RESEND_API_KEY é obrigatória com EMAIL_PROVIDER=resend.",
      });
  });
const inboundEmailEnvSchema = z
  .object({
    provider: z.enum(["disabled", "local", "generic_hmac"]),
    domain: z.string().trim().min(3).max(253),
    webhookSecret: z.string().min(32).optional(),
    maxAttachments: z.coerce.number().int().min(1).max(20),
  })
  .superRefine((value, context) => {
    if (value.provider !== "disabled" && !value.webhookSecret)
      context.addIssue({
        code: "custom",
        path: ["webhookSecret"],
        message: "INBOUND_WEBHOOK_SECRET deve ter ao menos 32 caracteres.",
      });
    if (process.env.NODE_ENV === "production" && value.provider === "local")
      context.addIssue({
        code: "custom",
        path: ["provider"],
        message: "O provedor local não pode ser usado em produção.",
      });
  });

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getSupabaseEnv(): SupabasePublicEnv {
  return supabaseEnvSchema.parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function getAppUrl(): string {
  return appUrlSchema.parse(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  );
}

export function getDocumentMaxSizeBytes(): number {
  const megabytes = documentMaxSizeSchema.parse(
    process.env.DOCUMENT_MAX_SIZE_MB ?? "10",
  );
  return megabytes * 1024 * 1024;
}

export function getServerSecrets() {
  return serverSecretsSchema.parse({
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    cronSecret: process.env.CRON_SECRET,
  });
}

export function getEmailEnv() {
  return emailEnvSchema.parse({
    provider:
      process.env.EMAIL_PROVIDER ??
      (process.env.NODE_ENV === "production" ? undefined : "local"),
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM ?? "Vencii <nao-responda@localhost>",
  });
}

export function getInboundEmailEnv() {
  return inboundEmailEnvSchema.parse({
    provider:
      process.env.INBOUND_EMAIL_PROVIDER ??
      (process.env.NODE_ENV === "production" ? "disabled" : "local"),
    domain: process.env.INBOUND_EMAIL_DOMAIN ?? "entrada.localhost",
    webhookSecret: process.env.INBOUND_WEBHOOK_SECRET,
    maxAttachments: process.env.INBOUND_MAX_ATTACHMENTS ?? "10",
  });
}

export function getInboundEmailDomain(): string {
  return z
    .string()
    .trim()
    .min(3)
    .max(253)
    .parse(process.env.INBOUND_EMAIL_DOMAIN ?? "entrada.localhost");
}
