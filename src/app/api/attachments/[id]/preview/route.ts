import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiWorkspace } from "@/dal/api-workspace";
import {
  createAttachmentSignedUrl,
  findAttachment,
} from "@/repositories/attachment-server.repository";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/attachments/[id]/preview">,
) {
  const workspace = await getApiWorkspace();
  if (!workspace)
    return NextResponse.json(
      { message: "Sessão ou organização inválida." },
      { status: 401 },
    );
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json(
      { message: "Documento inválido." },
      { status: 400 },
    );
  const attachment = await findAttachment(workspace.activeOrganization.id, id);
  if (!attachment)
    return NextResponse.json(
      { message: "Documento não encontrado." },
      { status: 404 },
    );
  const url = await createAttachmentSignedUrl(attachment, 120);
  return NextResponse.json(
    { url, expiresIn: 120 },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
