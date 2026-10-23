import type { ReactNode } from "react";

import type { OrganizationRole } from "@/types/database";

interface PermissionGuardProps {
  role: OrganizationRole;
  allowed: readonly OrganizationRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({
  role,
  allowed,
  children,
  fallback = null,
}: PermissionGuardProps) {
  return allowed.includes(role) ? children : fallback;
}
