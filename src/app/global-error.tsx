"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="pt-BR">
      <body className="grid min-h-screen place-items-center px-5 text-center">
        <main>
          <p className="text-primary text-sm font-semibold">
            Algo saiu do esperado
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            Não foi possível carregar a Vencii
          </h1>
          <p className="text-muted-foreground mt-3 text-sm">
            Tente novamente. Se o problema continuar, fale com o suporte.
          </p>
          <Button className="mt-6" onClick={unstable_retry}>
            Tentar novamente
          </Button>
        </main>
      </body>
    </html>
  );
}
