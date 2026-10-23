import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 text-center">
      <div>
        <p className="text-primary font-mono text-sm font-semibold">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Página não encontrada
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          O endereço pode ter mudado ou não existe.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">
            <ArrowLeft /> Voltar ao início
          </Link>
        </Button>
      </div>
    </main>
  );
}
