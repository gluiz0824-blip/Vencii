import { Bell, CheckCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import { EmptyState } from "@/components/product/empty-state";
import { PageHeader } from "@/components/product/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireWorkspace } from "@/dal/workspace";
import { notificationHref } from "@/domain/notifications/notification";
import { listUserNotifications } from "@/repositories/notification-server.repository";

export const metadata: Metadata = { title: "Notificações" };

export default async function NotificationsPage() {
  const workspace = await requireWorkspace();
  const notifications = await listUserNotifications(
    workspace.activeOrganization.id,
  );
  const hasUnread = notifications.some((item) => !item.read_at);

  return (
    <section className="app-page space-y-[var(--space-section)]">
      <PageHeader
        title="Notificações"
        description="Acompanhe vencimentos, aprovações e alertas da organização ativa."
        breadcrumbs={[
          { label: "Visão geral", href: "/app" },
          { label: "Notificações" },
        ]}
        actions={
          hasUnread ? (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="outline">
                <CheckCheck /> Marcar todas como lidas
              </Button>
            </form>
          ) : undefined
        }
      />

      {notifications.length ? (
        <Card className="shadow-card gap-0 py-0">
          <CardContent className="divide-y p-0">
            {notifications.map((item) => {
              const href = notificationHref({
                type: item.type,
                entityId: item.entity_id,
              });
              return (
                <article
                  key={item.id}
                  className="flex items-start gap-3 px-5 py-4 sm:px-6"
                >
                  <span
                    className={`mt-2 size-2 shrink-0 rounded-full ${item.read_at ? "bg-muted-foreground/30" : "bg-primary"}`}
                    aria-label={item.read_at ? "Lida" : "Não lida"}
                  />
                  <div className="min-w-0 flex-1">
                    <Link href={href} className="font-medium hover:underline">
                      {item.title}
                    </Link>
                    <p className="text-muted-foreground mt-1 text-sm leading-5">
                      {item.body}
                    </p>
                    <time
                      dateTime={item.created_at}
                      className="text-muted-foreground mt-2 block text-xs"
                    >
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: workspace.activeOrganization.timezone,
                      }).format(new Date(item.created_at))}
                    </time>
                  </div>
                  {!item.read_at && (
                    <form
                      action={markNotificationReadAction.bind(null, item.id)}
                    >
                      <Button type="submit" size="sm" variant="ghost">
                        Marcar como lida
                      </Button>
                    </form>
                  )}
                </article>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Nenhuma notificação"
          description="Os próximos alertas de vencimentos e aprovações aparecerão aqui."
          icon={Bell}
        />
      )}
    </section>
  );
}
