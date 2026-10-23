import "server-only";

import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import type { Database, ReminderEventType } from "@/types/database";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type ReminderRuleRow = Database["public"]["Tables"]["reminder_rules"]["Row"];

export type NotificationListItem = Pick<
  NotificationRow,
  | "id"
  | "type"
  | "title"
  | "body"
  | "entity_type"
  | "entity_id"
  | "read_at"
  | "created_at"
>;

export interface NotificationPreferenceItem {
  eventType: ReminderEventType;
  internalEnabled: boolean;
  emailEnabled: boolean;
}

export async function listUserNotifications(
  organizationId: string,
  limit = 50,
): Promise<NotificationListItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, type, title, body, entity_type, entity_id, read_at, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Não foi possível carregar as notificações.");
  return data ?? [];
}

export async function countUnreadNotifications(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("read_at", null);
  if (error) throw new Error("Não foi possível contar as notificações.");
  return count ?? 0;
}

export async function markNotificationRead(
  organizationId: string,
  notificationId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", notificationId);
  if (error)
    throw new Error("Não foi possível marcar a notificação como lida.");
}

export async function markAllNotificationsRead(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .is("read_at", null);
  if (error)
    throw new Error("Não foi possível marcar as notificações como lidas.");
}

export async function listReminderRules(
  organizationId: string,
): Promise<ReminderRuleRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reminder_rules")
    .select("*")
    .eq("organization_id", organizationId)
    .order("event_type")
    .order("channel");
  if (error) throw new Error("Não foi possível carregar os lembretes.");
  return data ?? [];
}

export async function listNotificationPreferences(
  organizationId: string,
  userId: string,
): Promise<NotificationPreferenceItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("event_type, internal_enabled, email_enabled")
    .eq("organization_id", organizationId)
    .eq("user_id", userId);
  if (error) throw new Error("Não foi possível carregar suas preferências.");
  return (data ?? []).map((item) => ({
    eventType: item.event_type,
    internalEnabled: item.internal_enabled,
    emailEnabled: item.email_enabled,
  }));
}

export async function saveNotificationPreference(input: {
  organizationId: string;
  userId: string;
  eventType: ReminderEventType;
  internalEnabled: boolean;
  emailEnabled: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("notification_preferences").upsert(
    {
      organization_id: input.organizationId,
      user_id: input.userId,
      event_type: input.eventType,
      internal_enabled: input.internalEnabled,
      email_enabled: input.emailEnabled,
    },
    { onConflict: "organization_id,user_id,event_type" },
  );
  if (error) throw new Error("Não foi possível salvar sua preferência.");
}
