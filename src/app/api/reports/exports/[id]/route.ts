import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiWorkspace } from "@/dal/api-workspace";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
export async function GET(
  _request: Request,
  context: RouteContext<"/api/reports/exports/[id]">,
) {
  const workspace = await getApiWorkspace();
  if (!workspace)
    return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json(
      { message: "Exportação inválida." },
      { status: 400 },
    );
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("report_exports")
    .select("storage_path,status,expires_at")
    .eq("id", id)
    .eq("organization_id", workspace.activeOrganization.id)
    .eq("requested_by", workspace.user.id)
    .maybeSingle();
  if (
    !data ||
    data.status !== "completed" ||
    !data.storage_path ||
    new Date(data.expires_at) <= new Date()
  )
    return NextResponse.json(
      { message: "Arquivo indisponível ou expirado." },
      { status: 404 },
    );
  const { data: signed, error } = await supabase.storage
    .from("report-exports")
    .createSignedUrl(data.storage_path, 120);
  if (error)
    return NextResponse.json(
      { message: "Não foi possível autorizar o download." },
      { status: 500 },
    );
  return NextResponse.redirect(signed.signedUrl, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
