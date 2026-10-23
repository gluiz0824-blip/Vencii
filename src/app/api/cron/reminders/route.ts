import { timingSafeEqual } from "node:crypto";

import { getServerSecrets } from "@/config/env";
import { runReminderJob } from "@/services/notifications/reminder-job.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const expected = `Bearer ${getServerSecrets().cronSecret}`;
  const received = request.headers.get("authorization") ?? "";
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}

export async function GET(request: Request) {
  if (!authorized(request))
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  try {
    return Response.json({ ok: true, ...(await runReminderJob()) });
  } catch {
    return Response.json(
      { ok: false, error: "Não foi possível executar os lembretes." },
      { status: 500 },
    );
  }
}
