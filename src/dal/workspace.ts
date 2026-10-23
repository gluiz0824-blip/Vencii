import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import {
  findActiveOrganizations,
  type OrganizationSummary,
} from "@/repositories/organization-server.repository";
import { getCurrentUser } from "@/services/auth/auth-server.service";
import { getActiveOrganizationId } from "@/services/organization/active-organization.service";

export interface WorkspaceContext {
  user: { id: string; email: string };
  organizations: OrganizationSummary[];
  activeOrganization: OrganizationSummary;
}

export const getWorkspaceState = cache(async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  const organizations = await findActiveOrganizations(user.id);
  const activeOrganizationId = await getActiveOrganizationId();
  const activeOrganization = organizations.find(
    (organization) => organization.id === activeOrganizationId,
  );

  return {
    user: { id: user.id, email: user.email ?? "Usuário" },
    organizations,
    activeOrganization,
  };
});

export const requireWorkspace = cache(async (): Promise<WorkspaceContext> => {
  const state = await getWorkspaceState();

  if (state.organizations.length === 0) redirect("/onboarding");
  if (!state.activeOrganization) redirect("/selecionar-organizacao");

  return { ...state, activeOrganization: state.activeOrganization };
});
