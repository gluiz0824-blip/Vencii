import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/config/env";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const requestedPath = request.nextUrl.searchParams.get("next");
  const safePath =
    requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
      ? requestedPath
      : "/app";
  if (hasSupabaseEnv() && tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(new URL(safePath, request.url));
  }
  return NextResponse.redirect(
    new URL("/entrar?erro=confirmacao", request.url),
  );
}
