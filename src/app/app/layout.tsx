import { AppShell } from "@/components/layout/app-shell";
import { requireWorkspace } from "@/dal/workspace";
import {
  countUnreadNotifications,
  listUserNotifications,
  type NotificationListItem,
} from "@/repositories/notification-server.repository";

export default async function ProductLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const workspace = await requireWorkspace();
  const notificationState: [NotificationListItem[], number] = await Promise.all(
    [
      listUserNotifications(workspace.activeOrganization.id, 5),
      countUnreadNotifications(workspace.activeOrganization.id),
    ],
  ).catch(() => [[], 0]);

  return (
    <AppShell
      email={workspace.user.email}
      activeOrganization={workspace.activeOrganization}
      organizations={workspace.organizations}
      notifications={notificationState[0]}
      unreadNotifications={notificationState[1]}
    >
      {children}
    </AppShell>
  );
}
