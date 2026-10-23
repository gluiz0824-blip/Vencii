import { ArrowRight, Building2 } from "lucide-react";

import { switchOrganizationAction } from "@/app/actions/organization";
import { Button } from "@/components/ui/button";
import type { OrganizationSummary } from "@/repositories/organization-server.repository";

const roleLabels: Record<OrganizationSummary["role"], string> = {
  owner: "Owner",
  admin: "Administrador",
  approver: "Aprovador",
  operator: "Operador",
  viewer: "Leitura",
};

interface OrganizationSelectionListProps {
  organizations: OrganizationSummary[];
}

export function OrganizationSelectionList({
  organizations,
}: OrganizationSelectionListProps) {
  return (
    <div className="space-y-3">
      {organizations.map((organization) => (
        <form
          key={organization.id}
          action={switchOrganizationAction}
          className="bg-card flex items-center gap-4 rounded-xl border p-4"
        >
          <input type="hidden" name="organizationId" value={organization.id} />
          <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-xl">
            <Building2 className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">
              {organization.tradeName}
            </span>
            <span className="text-muted-foreground block truncate text-xs">
              {organization.legalName} · {roleLabels[organization.role]}
            </span>
          </span>
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            aria-label={`Acessar ${organization.tradeName}`}
          >
            <ArrowRight />
          </Button>
        </form>
      ))}
    </div>
  );
}
