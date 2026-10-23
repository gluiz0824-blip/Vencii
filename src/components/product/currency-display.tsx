import { formatMoney, type MoneyInCents } from "@/domain/shared/money";
import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
  value: MoneyInCents;
  className?: string;
}

export function CurrencyDisplay({ value, className }: CurrencyDisplayProps) {
  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {formatMoney(value)}
    </span>
  );
}
