import "server-only";

import { cookies } from "next/headers";

export const ACTIVE_ORGANIZATION_COOKIE = "vencii_active_organization";

export async function getActiveOrganizationId(): Promise<string | undefined> {
  return (await cookies()).get(ACTIVE_ORGANIZATION_COOKIE)?.value;
}

export async function setActiveOrganizationId(
  organizationId: string,
): Promise<void> {
  (await cookies()).set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearActiveOrganizationId(): Promise<void> {
  (await cookies()).delete(ACTIVE_ORGANIZATION_COOKIE);
}
