import { BellRing, LockKeyhole, Mail } from "lucide-react";
import type { Metadata } from "next";

import { saveNotificationPreferenceAction } from "@/app/actions/notifications";
import { PageHeader } from "@/components/product/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspace } from "@/dal/workspace";
import { notificationLabels } from "@/domain/notifications/notification";
import {
  listNotificationPreferences,
  listReminderRules,
} from "@/repositories/notification-server.repository";
import type { ReminderEventType } from "@/types/database";

export const metadata: Metadata = { title: "Preferências de notificações" };

export default async function NotificationSettingsPage() {
  const workspace = await requireWorkspace();
  const [rules, preferences] = await Promise.all([
    listReminderRules(workspace.activeOrganization.id),
    listNotificationPreferences(
      workspace.activeOrganization.id,
      workspace.user.id,
    ),
  ]);
  const events = [...new Set(rules.map((rule) => rule.event_type))];
  const preferencesByEvent = new Map(
    preferences.map((preference) => [preference.eventType, preference]),
  );

  return (
    <section className="app-page space-y-[var(--space-section)]">
      <PageHeader
        title="Notificações e lembretes"
        description="Escolha como deseja receber alertas não críticos da organização ativa."
        breadcrumbs={[
          { label: "Configurações", href: "/app/configuracoes" },
          { label: "Notificações" },
        ]}
      />

      <Card className="shadow-card gap-0 py-0">
        <CardHeader className="border-b px-5 py-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="text-primary size-4" /> Suas preferências
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {events.map((eventType) => (
            <PreferenceRow
              key={eventType}
              eventType={eventType}
              critical={rules.some(
                (rule) => rule.event_type === eventType && rule.critical,
              )}
              hasEmail={rules.some(
                (rule) =>
                  rule.event_type === eventType &&
                  rule.channel === "email" &&
                  rule.active,
              )}
              internalEnabled={
                preferencesByEvent.get(eventType)?.internalEnabled ?? true
              }
              emailEnabled={
                preferencesByEvent.get(eventType)?.emailEnabled ?? true
              }
            />
          ))}
        </CardContent>
      </Card>

      <p className="text-muted-foreground flex items-start gap-2 text-xs leading-5">
        <Mail className="mt-0.5 size-4 shrink-0" /> O canal WhatsApp está apenas
        preparado na arquitetura. A Vencii não usa automações não oficiais.
      </p>
    </section>
  );
}

function PreferenceRow(props: {
  eventType: ReminderEventType;
  critical: boolean;
  hasEmail: boolean;
  internalEnabled: boolean;
  emailEnabled: boolean;
}) {
  return (
    <form
      action={saveNotificationPreferenceAction}
      className="grid gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
    >
      <input type="hidden" name="eventType" value={props.eventType} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium">{notificationLabels[props.eventType]}</h2>
          {props.critical && (
            <Badge variant="secondary">
              <LockKeyhole /> Alerta crítico
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          {props.critical
            ? "Definido pela empresa e sempre ativo."
            : "Você pode alterar estes canais a qualquer momento."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {props.critical && (
          <>
            <input type="hidden" name="internalEnabled" value="on" />
            <input type="hidden" name="emailEnabled" value="on" />
          </>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="internalEnabled"
            defaultChecked={props.internalEnabled || props.critical}
            disabled={props.critical}
            className="accent-primary size-4"
          />
          No aplicativo
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="emailEnabled"
            defaultChecked={props.emailEnabled || props.critical}
            disabled={props.critical || !props.hasEmail}
            className="accent-primary size-4"
          />
          E-mail
        </label>
        <Button type="submit" size="sm" variant="outline">
          Salvar
        </Button>
      </div>
    </form>
  );
}
