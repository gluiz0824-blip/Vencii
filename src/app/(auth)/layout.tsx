import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="bg-muted/30 relative grid min-h-screen place-items-center px-5 py-16">
      <div className="absolute start-5 top-5 sm:start-8 sm:top-7">
        <BrandLogo />
      </div>
      <div className="absolute end-5 top-5 sm:end-8 sm:top-7">
        <ThemeToggle />
      </div>
      {children}
    </main>
  );
}
