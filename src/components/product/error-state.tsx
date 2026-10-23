"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Não foi possível carregar esta área",
  description = "Tente novamente. Se o problema continuar, atualize a página.",
  onRetry,
}: ErrorStateProps) {
  return (
    <Card role="alert" className="border-destructive/20 mx-auto max-w-2xl py-0">
      <CardContent className="flex flex-col items-center px-6 py-12 text-center">
        <span className="bg-destructive/10 text-destructive mb-4 grid size-11 place-items-center rounded-xl">
          <TriangleAlert className="size-5" aria-hidden="true" />
        </span>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-muted-foreground mt-2 max-w-md text-sm leading-6">
          {description}
        </p>
        {onRetry && (
          <Button className="mt-5" onClick={onRetry}>
            <RotateCcw /> Tentar novamente
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
