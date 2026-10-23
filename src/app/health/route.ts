export const dynamic = "force-dynamic";
export function GET() {
  return Response.json(
    { status: "ok", application: "vencii" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
