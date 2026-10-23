"use client";

import { useState, type ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import type { OrganizationSummary } from "@/repositories/organization-server.repository";
import type { NotificationListItem } from "@/repositories/notification-server.repository";

interface AppShellProps {
  children: ReactNode;
  email: string;
  activeOrganization: OrganizationSummary;
  organizations: OrganizationSummary[];
  notifications: NotificationListItem[];
  unreadNotifications: number;
}

export function AppShell({
  children,
  email,
  activeOrganization,
  organizations,
  notifications,
  unreadNotifications,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="bg-muted/25 min-h-screen">
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((current) => !current)}
      />
      <div
        className={
          sidebarCollapsed
            ? "transition-[padding] duration-200 lg:ps-20"
            : "transition-[padding] duration-200 lg:ps-64"
        }
      >
        <AppHeader
          email={email}
          activeOrganization={activeOrganization}
          organizations={organizations}
          notifications={notifications}
          unreadNotifications={unreadNotifications}
        />
        <main className="px-[var(--space-page-x)] py-[var(--space-page-y)]">
          {children}
        </main>
      </div>
    </div>
  );
}
