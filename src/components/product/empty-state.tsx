import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: ReactNode;
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
}: EmptyStateProps) {
  return (
    <Card className="shadow-card border-dashed py-0">
      <CardContent className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
        <span className="bg-muted text-muted-foreground mb-5 grid size-12 place-items-center rounded-xl border">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-2 max-w-md text-sm leading-6">
          {description}
        </p>
        {action && <div className="mt-5">{action}</div>}
      </CardContent>
    </Card>
  );
}
