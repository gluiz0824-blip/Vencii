import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServerSecrets, getSupabaseEnv } from "@/config/env";
import type { Database } from "@/types/database";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function createSupabaseAdminClient() {
  if (!adminClient) {
    const publicEnv = getSupabaseEnv();
    const { serviceRoleKey } = getServerSecrets();
    adminClient = createClient<Database>(publicEnv.url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}
