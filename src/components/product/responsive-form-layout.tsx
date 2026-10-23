import type { ReactNode } from "react";

interface ResponsiveFormLayoutProps {
  children: ReactNode;
  aside?: ReactNode;
}

export function ResponsiveFormLayout({
  children,
  aside,
}: ResponsiveFormLayoutProps) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0">{children}</div>
      {aside && <aside className="min-w-0 lg:sticky lg:top-24">{aside}</aside>}
    </div>
  );
}
