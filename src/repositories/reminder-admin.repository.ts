import "server-only";

import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin";

export interface ClaimedReminderDelivery {
  deliveryId: string;
  recipientEmail: string;
  idempotencyKey: string;
  title: string;
  body: string;
  path: string;
  attempt: number;
}

export async function scheduleReminders(now = new Date()) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("schedule_reminders", {
    p_now: now.toISOString(),
  });
  if (error) throw new Error(`Falha ao agendar lembretes: ${error.message}`);
  return data?.[0] ?? { notifications_created: 0, deliveries_created: 0 };
}

export async function claimReminderDeliveries(limit = 25) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("claim_reminder_deliveries", {
    p_limit: limit,
  });
  if (error) throw new Error(`Falha ao consumir lembretes: ${error.message}`);
  return (data ?? []).map((item): ClaimedReminderDelivery => ({
    deliveryId: item.delivery_id,
    recipientEmail: item.recipient_email,
    idempotencyKey: item.idempotency_key,
    title: item.title,
    body: item.body,
    path: item.path,
    attempt: item.attempt,
  }));
}

export async function finishReminderDelivery(input: {
  deliveryId: string;
  success: boolean;
  providerMessageId?: string;
  errorCode?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("finish_reminder_delivery", {
    p_delivery_id: input.deliveryId,
    p_success: input.success,
    p_provider_message_id: input.providerMessageId ?? null,
    p_error_code: input.errorCode ?? null,
  });
  if (error) throw new Error(`Falha ao concluir lembrete: ${error.message}`);
}
