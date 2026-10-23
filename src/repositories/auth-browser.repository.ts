import { getSupabaseBrowserClient } from "@/infrastructure/supabase/client";
import type { SignInCredentials } from "@/repositories/auth.repository";

export async function signInWithPassword({
  email,
  password,
}: SignInCredentials): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(error.message);
  }
}
