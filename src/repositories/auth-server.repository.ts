import "server-only";

import type { User } from "@supabase/supabase-js";
import { connection } from "next/server";

import { hasSupabaseEnv } from "@/config/env";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";

export async function getAuthenticatedUser(): Promise<User | null> {
  await connection();

  if (!hasSupabaseEnv()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
}
