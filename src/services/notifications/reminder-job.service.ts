import "server-only";

import { getAppUrl } from "@/config/env";
import {
  EmailProviderError,
  getEmailProvider,
  type EmailProvider,
} from "@/infrastructure/email/email-provider";
import {
  claimReminderDeliveries,
  finishReminderDelivery,
  scheduleReminders,
} from "@/repositories/reminder-admin.repository";
import { buildReminderEmail } from "@/services/notifications/reminder-email";

export async function runReminderJob(input?: {
  now?: Date;
  provider?: EmailProvider;
}) {
  const scheduled = await scheduleReminders(input?.now);
  const deliveries = await claimReminderDeliveries();
  const provider = input?.provider ?? getEmailProvider();
  let sent = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    try {
      const result = await provider.send(
        buildReminderEmail({
          recipientEmail: delivery.recipientEmail,
          title: delivery.title,
          body: delivery.body,
          path: delivery.path,
          appUrl: getAppUrl(),
          idempotencyKey: delivery.idempotencyKey,
        }),
      );
      await finishReminderDelivery({
        deliveryId: delivery.deliveryId,
        success: true,
        providerMessageId: result.messageId,
      });
      sent += 1;
    } catch (error) {
      await finishReminderDelivery({
        deliveryId: delivery.deliveryId,
        success: false,
        errorCode:
          error instanceof EmailProviderError
            ? error.code
            : "temporary_failure",
      });
      failed += 1;
    }
  }

  return {
    notificationsCreated: scheduled.notifications_created,
    deliveriesCreated: scheduled.deliveries_created,
    claimed: deliveries.length,
    sent,
    failed,
  };
}
