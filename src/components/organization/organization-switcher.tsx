"use client";

import { Building2, Check, ChevronsUpDown } from "lucide-react";

import { switchOrganizationAction } from "@/app/actions/organization";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OrganizationSummary } from "@/repositories/organization-server.repository";

interface OrganizationSwitcherProps {
  activeOrganization: OrganizationSummary;
  organizations: OrganizationSummary[];
}

export function OrganizationSwitcher({
  activeOrganization,
  organizations,
}: OrganizationSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 max-w-44 justify-start gap-2 px-1.5 sm:max-w-64 sm:gap-3 sm:px-2"
          aria-label="Trocar organização"
        >
          <span className="bg-primary/10 text-primary grid size-7 shrink-0 place-items-center rounded-lg sm:size-8">
            <Building2 className="size-4" />
          </span>
          <span className="min-w-0 text-start">
            <span className="block truncate text-sm font-semibold">
              {activeOrganization.tradeName}
            </span>
            <span className="text-muted-foreground hidden text-[11px] sm:block">
              Organização atual
            </span>
          </span>
          <ChevronsUpDown className="text-muted-foreground ms-auto size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[min(18rem,calc(100vw-2rem))]"
      >
        <DropdownMenuLabel>Trocar organização</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((organization) => (
          <form key={organization.id} action={switchOrganizationAction}>
            <input
              type="hidden"
              name="organizationId"
              value={organization.id}
            />
            <button
              type="submit"
              className="hover:bg-muted focus-visible:ring-ring flex w-full items-center gap-3 rounded-md px-2 py-2 text-start text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="grid size-8 place-items-center rounded-lg border">
                <Building2 className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {organization.tradeName}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {organization.legalName}
                </span>
              </span>
              {organization.id === activeOrganization.id && (
                <Check className="text-primary size-4" />
              )}
            </button>
          </form>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
