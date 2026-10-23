import { CircleCheck } from "lucide-react";

import { cn } from "@/lib/utils";

interface SuccessStateProps {
  title: string;
  description: string;
  className?: string;
}

export function SuccessState({
  title,
  description,
  className,
}: SuccessStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "border-status-paid/20 bg-status-paid-muted text-status-paid-foreground flex items-start gap-3 rounded-lg border p-3",
        className,
      )}
    >
      <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="text-xs font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-5">{description}</p>
      </div>
    </div>
  );
}
