import {
  formatBusinessDate,
  type BusinessDate,
} from "@/domain/shared/business-date";
import { cn } from "@/lib/utils";

interface DateDisplayProps {
  value: BusinessDate;
  className?: string;
}

export function DateDisplay({ value, className }: DateDisplayProps) {
  return (
    <time dateTime={value} className={cn("tabular-nums", className)}>
      {formatBusinessDate(value)}
    </time>
  );
}
