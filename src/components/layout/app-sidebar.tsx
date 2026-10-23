"use client";

import { PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react";

import { AppNav } from "@/components/layout/app-nav";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  return (
    <aside
      className={cn(
        "border-sidebar-border bg-sidebar fixed inset-y-0 start-0 z-30 hidden border-e transition-[width] duration-200 lg:flex lg:flex-col",
        collapsed ? "w-20" : "w-64",
      )}
      aria-label="Barra lateral"
    >
      <div
        className={cn(
          "flex h-16 items-center gap-1",
          collapsed ? "justify-between px-2" : "justify-between px-4",
        )}
      >
        <BrandLogo href="/app" compact={collapsed} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggle}
              aria-label={
                collapsed ? "Expandir barra lateral" : "Recolher barra lateral"
              }
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? "Expandir menu" : "Recolher menu"}
          </TooltipContent>
        </Tooltip>
      </div>
      <Separator />
      <div className="flex-1 overflow-y-auto px-3 py-5">
        {!collapsed && (
          <p className="text-sidebar-foreground/45 mb-3 px-3 text-[11px] font-semibold tracking-[0.12em] uppercase">
            Organização
          </p>
        )}
        <AppNav collapsed={collapsed} />
      </div>
      <div className="p-3">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="text-primary focus-visible:ring-ring mx-auto grid size-9 place-items-center rounded-lg outline-none focus-visible:ring-2"
                aria-label="Ambiente seguro"
                tabIndex={0}
              >
                <ShieldCheck className="size-4" aria-hidden="true" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">
              Ambiente seguro: a Vencii não executa transações.
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="border-sidebar-border bg-background/70 rounded-xl border p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <ShieldCheck className="text-primary size-4" aria-hidden="true" />
              Ambiente seguro
            </div>
            <p className="text-muted-foreground mt-1.5 text-xs leading-5">
              A Vencii organiza pagamentos. Nenhuma transação é executada aqui.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
