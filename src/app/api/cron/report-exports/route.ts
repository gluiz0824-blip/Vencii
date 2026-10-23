import { timingSafeEqual } from "node:crypto";
import { getServerSecrets } from "@/config/env";
import { runReportExportJob } from "@/services/reports/report-export-job.service";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
function authorized(request: Request) {
  const expected = Buffer.from(`Bearer ${getServerSecrets().cronSecret}`),
    received = Buffer.from(request.headers.get("authorization") ?? "");
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
export async function GET(request: Request) {
  if (!authorized(request))
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  try {
    return Response.json({ ok: true, ...(await runReportExportJob()) });
  } catch {
    return Response.json(
      { ok: false, error: "Não foi possível processar as exportações." },
      { status: 500 },
    );
  }
}
