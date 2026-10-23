import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiWorkspace } from "@/dal/api-workspace";
import { processDocument } from "@/services/attachments/attachment.service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/attachments/[id]/process">,
) {
  const workspace = await getApiWorkspace();
  if (!workspace)
    return NextResponse.json(
      { message: "Sessão ou organização inválida." },
      { status: 401 },
    );
  if (!workspace.canWrite)
    return NextResponse.json(
      { message: "Sem permissão para processar documentos." },
      { status: 403 },
    );
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json(
      { message: "Documento inválido." },
      { status: 400 },
    );
  try {
    const attachment = await processDocument(
      workspace.activeOrganization.id,
      id,
    );
    return NextResponse.json({
      id,
      status: attachment?.extraction_status ?? "processing",
      reviewUrl: `/app/contas-a-pagar/anexos/${id}/revisar`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Falha no processamento.",
      },
      { status: 409 },
    );
  }
}
