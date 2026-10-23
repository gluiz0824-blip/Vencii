"use client";

import {
  CalendarDays,
  ChartNoAxesCombined,
  CheckCheck,
  CircleDollarSign,
  Inbox,
  LayoutDashboard,
  Settings,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/app", label: "Visão geral", icon: LayoutDashboard },
  {
    href: "/app/contas-a-pagar",
    label: "Contas a pagar",
    icon: CircleDollarSign,
  },
  { href: "/app/caixa-de-entrada", label: "Caixa de entrada", icon: Inbox },
  { href: "/app/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/app/aprovacoes", label: "Aprovações", icon: CheckCheck },
  { href: "/app/fornecedores", label: "Fornecedores", icon: UsersRound },
  { href: "/app/relatorios", label: "Relatórios", icon: ChartNoAxesCombined },
  { href: "/app/configuracoes", label: "Configurações", icon: Settings },
] as const;

interface AppNavProps {
  onNavigate?: () => void;
  collapsed?: boolean;
}

export function AppNav({ onNavigate, collapsed = false }: AppNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="space-y-1">
      {navigation.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/app" ? pathname === href : pathname.startsWith(href);
        const link = (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            aria-label={collapsed ? label : undefined}
            className={cn(
              "focus-visible:ring-ring flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
              collapsed && "justify-center px-0",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
            )}
          >
            <Icon
              className={cn("size-4 shrink-0", isActive && "text-primary")}
              aria-hidden="true"
            />
            {!collapsed && <span>{label}</span>}
          </Link>
        );

        return collapsed ? (
          <Tooltip key={href}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ) : (
          link
        );
      })}
    </nav>
  );
}
