import Link from "next/link";

import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  href?: string;
  compact?: boolean;
}

export function BrandLogo({
  className,
  href = "/",
  compact = false,
}: BrandLogoProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 font-semibold tracking-tight",
        className,
      )}
      aria-label="Vencii — página inicial"
    >
      <span className="bg-primary text-primary-foreground relative grid size-8 place-items-center overflow-hidden rounded-[10px] text-sm font-bold shadow-sm">
        V
        <span className="absolute end-1.5 top-1.5 size-1.5 rounded-full bg-blue-300" />
      </span>
      {!compact && <span className="text-lg">Vencii</span>}
    </Link>
  );
}
