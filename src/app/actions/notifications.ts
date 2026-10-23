"use server";

import { revalidatePath } from "next/cache";

import { requireWorkspace } from "@/dal/workspace";
import {
  markAllNotificationsRead,
  markNotificationRead,
  saveNotificationPreference,
} from "@/repositories/notification-server.repository";
import {
  notificationIdSchema,
  notificationPreferenceSchema,
} from "@/validation/notification";

export async function markNotificationReadAction(notificationId: string) {
  const parsed = notificationIdSchema.safeParse(notificationId);
  if (!parsed.success) throw new Error("Notificação inválida.");
  const workspace = await requireWorkspace();
  await markNotificationRead(workspace.activeOrganization.id, parsed.data);
  revalidatePath("/app/notificacoes");
  revalidatePath("/app", "layout");
}

export async function markAllNotificationsReadAction() {
  const workspace = await requireWorkspace();
  await markAllNotificationsRead(workspace.activeOrganization.id);
  revalidatePath("/app/notificacoes");
  revalidatePath("/app", "layout");
}

export async function saveNotificationPreferenceAction(formData: FormData) {
  const parsed = notificationPreferenceSchema.safeParse({
    eventType: formData.get("eventType"),
    internalEnabled: formData.get("internalEnabled") === "on",
    emailEnabled: formData.get("emailEnabled") === "on",
  });
  if (!parsed.success) throw new Error("Preferência inválida.");
  const workspace = await requireWorkspace();
  await saveNotificationPreference({
    organizationId: workspace.activeOrganization.id,
    userId: workspace.user.id,
    ...parsed.data,
  });
  revalidatePath("/app/configuracoes/notificacoes");
}
