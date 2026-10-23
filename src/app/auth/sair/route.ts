import { type NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/config/env";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { clearActiveOrganizationId } from "@/services/organization/active-organization.service";
export async function POST(request: NextRequest) {
  if (hasSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  await clearActiveOrganizationId();
  return NextResponse.redirect(new URL("/entrar", request.url), {
    status: 303,
  });
}
