import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/config/env";
import type { Database } from "@/types/database";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const env = getSupabaseEnv();
    browserClient = createBrowserClient<Database>(env.url, env.publishableKey);
  }

  return browserClient;
}
