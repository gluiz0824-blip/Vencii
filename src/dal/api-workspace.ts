import "server-only";

import { PAYABLE_WRITE_ROLES } from "@/domain/payables/payable";
import { findActiveOrganizations } from "@/repositories/organization-server.repository";
import { getCurrentUser } from "@/services/auth/auth-server.service";
import { getActiveOrganizationId } from "@/services/organization/active-organization.service";

export async function getApiWorkspace() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [organizations, activeOrganizationId] = await Promise.all([
    findActiveOrganizations(user.id),
    getActiveOrganizationId(),
  ]);
  const activeOrganization = organizations.find(
    ({ id }) => id === activeOrganizationId,
  );
  if (!activeOrganization) return null;
  return {
    user,
    activeOrganization,
    canWrite: (PAYABLE_WRITE_ROLES as readonly string[]).includes(
      activeOrganization.role,
    ),
  };
}
