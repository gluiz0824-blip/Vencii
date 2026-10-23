import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  helper: string;
  icon: LucideIcon;
}

export function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
}: MetricCardProps) {
  return (
    <Card className="shadow-card gap-0 py-0">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <p className="text-muted-foreground text-sm font-medium">{label}</p>
          <span className="bg-secondary text-secondary-foreground grid size-9 shrink-0 place-items-center rounded-lg">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </div>
        <div className="mt-4 font-mono text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </div>
        <p className="text-muted-foreground mt-1.5 text-xs leading-5">
          {helper}
        </p>
      </CardContent>
    </Card>
  );
}
