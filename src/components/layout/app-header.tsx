import { Bell, ChevronDown, Search } from "lucide-react";
import Link from "next/link";

import { MobileNav } from "@/components/layout/mobile-nav";
import { OrganizationSwitcher } from "@/components/organization/organization-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OrganizationSummary } from "@/repositories/organization-server.repository";
import type { NotificationListItem } from "@/repositories/notification-server.repository";
import { notificationHref } from "@/domain/notifications/notification";

interface AppHeaderProps {
  email: string;
  activeOrganization: OrganizationSummary;
  organizations: OrganizationSummary[];
  notifications: NotificationListItem[];
  unreadNotifications: number;
}

export function AppHeader({
  email,
  activeOrganization,
  organizations,
  notifications,
  unreadNotifications,
}: AppHeaderProps) {
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <header className="bg-background/95 sticky top-0 z-20 flex h-16 items-center border-b px-3 backdrop-blur sm:px-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
        <MobileNav />
        <OrganizationSwitcher
          activeOrganization={activeOrganization}
          organizations={organizations}
        />
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="text-muted-foreground me-2 hidden w-56 justify-start md:flex xl:w-72"
              disabled
              aria-label="Busca global — em breve"
            >
              <Search />
              <span>Buscar na Vencii</span>
              <kbd className="bg-muted ms-auto rounded border px-1.5 py-0.5 font-mono text-[10px]">
                ⌘ K
              </kbd>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Busca global em breve</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  aria-label={`Notificações${unreadNotifications ? `, ${unreadNotifications} não lidas` : ""}`}
                >
                  <Bell />
                  {unreadNotifications > 0 && (
                    <span className="bg-primary text-primary-foreground absolute top-0.5 right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[9px] leading-4 font-bold">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Notificações</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notificações recentes</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length ? (
              notifications.map((notification) => (
                <DropdownMenuItem key={notification.id} asChild>
                  <Link
                    href={notificationHref({
                      type: notification.type,
                      entityId: notification.entity_id,
                    })}
                    className="items-start py-2"
                  >
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.read_at ? "bg-muted-foreground/30" : "bg-primary"}`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {notification.title}
                      </span>
                      <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-xs">
                        {notification.body}
                      </span>
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))
            ) : (
              <p className="text-muted-foreground px-2 py-4 text-center text-xs">
                Nenhuma notificação recente.
              </p>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/app/notificacoes" className="justify-center">
                Ver todas as notificações
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-10 gap-2 px-1.5 sm:px-2"
              aria-label="Abrir menu da conta"
            >
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-40 truncate text-xs xl:inline">
                {email}
              </span>
              <ChevronDown className="text-muted-foreground hidden size-3.5 sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="min-w-0">
              <span className="text-muted-foreground block text-xs font-normal">
                Conta conectada
              </span>
              <span className="mt-0.5 block truncate">{email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/app/configuracoes">Configurações</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <form action="/auth/sair" method="post" className="w-full">
                <button type="submit" className="w-full text-start">
                  Sair
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
