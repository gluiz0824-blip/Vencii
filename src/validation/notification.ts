import { z } from "zod";

export const notificationIdSchema = z.uuid();

export const notificationPreferenceSchema = z.object({
  eventType: z.enum([
    "payable_due_7_days",
    "payable_due_3_days",
    "payable_due_tomorrow",
    "payable_due_today",
    "payable_overdue",
    "approval_requested",
    "approval_due_soon",
    "approval_completed",
    "approval_rejected",
    "document_extraction_failed",
  ]),
  internalEnabled: z.boolean(),
  emailEnabled: z.boolean(),
});
