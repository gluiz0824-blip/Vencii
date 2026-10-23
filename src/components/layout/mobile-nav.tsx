"use client";

import { Menu, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { AppNav } from "@/components/layout/app-nav";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Abrir menu principal"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(20rem,88vw)] p-0">
        <SheetHeader className="border-b px-5 py-4 text-start">
          <SheetTitle>
            <BrandLogo href="/app" />
          </SheetTitle>
        </SheetHeader>
        <div className="px-3 py-5">
          <AppNav onNavigate={() => setOpen(false)} />
        </div>
        <div className="mt-auto border-t p-5">
          <p className="flex items-center gap-2 text-xs font-semibold">
            <ShieldCheck className="text-primary size-4" aria-hidden="true" />
            Ambiente seguro
          </p>
          <p className="text-muted-foreground mt-1.5 text-xs leading-5">
            A Vencii não executa transações financeiras.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
