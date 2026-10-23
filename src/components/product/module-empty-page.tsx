import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/product/empty-state";
import { PageHeader } from "@/components/product/page-header";

interface ModuleEmptyPageProps {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  icon: LucideIcon;
}

export function ModuleEmptyPage({
  title,
  description,
  emptyTitle,
  emptyDescription,
  icon,
}: ModuleEmptyPageProps) {
  return (
    <section className="app-page space-y-[var(--space-section)]">
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={[{ label: "Visão geral", href: "/app" }, { label: title }]}
      />
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={icon}
      />
    </section>
  );
}
