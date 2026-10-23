import { signInWithPassword } from "@/repositories/auth-browser.repository";
import type { SignInCredentials } from "@/repositories/auth.repository";

export async function authenticate(
  credentials: SignInCredentials,
): Promise<void> {
  await signInWithPassword({
    email: credentials.email.trim().toLowerCase(),
    password: credentials.password,
  });
}
