"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireWorkspace } from "@/dal/workspace";
import {
  ignoreInboundMessage,
  rotateInboundAddress,
} from "@/repositories/inbound-email-server.repository";

const idSchema = z.uuid();

export async function rotateInboundAddressAction() {
  const workspace = await requireWorkspace();
  if (
    !(["owner", "admin"] as const).includes(
      workspace.activeOrganization.role as "owner" | "admin",
    )
  )
    throw new Error("Somente owner ou admin pode rotacionar o endereço.");
  await rotateInboundAddress(workspace.activeOrganization.id);
  revalidatePath("/app/caixa-de-entrada");
}

export async function ignoreInboundMessageAction(messageId: string) {
  const parsed = idSchema.safeParse(messageId);
  if (!parsed.success) throw new Error("Mensagem inválida.");
  const workspace = await requireWorkspace();
  await ignoreInboundMessage(workspace.activeOrganization.id, parsed.data);
  revalidatePath("/app/caixa-de-entrada");
}
