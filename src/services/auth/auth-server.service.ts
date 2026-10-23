import "server-only";

import type { User } from "@supabase/supabase-js";

import { getAuthenticatedUser } from "@/repositories/auth-server.repository";

export async function getCurrentUser(): Promise<User | null> {
  return getAuthenticatedUser();
}
