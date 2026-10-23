import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const benefits = [
  {
    icon: CalendarCheck2,
    title: "Vencimentos sob controle",
    description:
      "Organize compromissos em uma agenda única e reduza surpresas no caixa.",
  },
  {
    icon: FileCheck2,
    title: "Processo rastreável",
    description:
      "Centralize responsáveis, aprovações e comprovantes sem depender de planilhas soltas.",
  },
  {
    icon: ShieldCheck,
    title: "Clareza sem movimentar dinheiro",
    description:
      "A Vencii organiza a operação; sua empresa mantém os pagamentos nos canais de confiança.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="bg-background min-h-screen">
      <header className="bg-background/90 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <BrandLogo />
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/entrar">Acessar conta</Link>
            </Button>
            <Button asChild>
              <Link href="/entrar">Começar</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden border-b">
          <div className="absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_70%_0%,color-mix(in_oklch,var(--primary)_13%,transparent),transparent_58%)]" />
          <div className="mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:py-32">
            <div>
              <Badge
                variant="secondary"
                className="text-primary mb-6 rounded-full px-3 py-1 font-medium"
              >
                Feito para pequenas empresas brasileiras
              </Badge>
              <h1 className="max-w-3xl text-4xl leading-[1.08] font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
                Contas organizadas. Decisões mais tranquilas.
              </h1>
              <p className="text-muted-foreground mt-6 max-w-2xl text-base leading-7 sm:text-lg">
                Reúna boletos, vencimentos, fornecedores, aprovações e
                comprovantes em um só lugar — sem transformar sua rotina
                financeira em outro sistema complexo.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-11 px-5">
                  <Link href="/entrar">
                    Organizar minhas contas <ArrowRight />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-11 px-5"
                >
                  <Link href="#como-funciona">Conhecer a proposta</Link>
                </Button>
              </div>
              <p className="text-muted-foreground mt-5 flex items-center gap-2 text-xs">
                <CheckCircle2 className="size-4 text-emerald-600" /> Sem
                execução de pagamentos e sem substituir seu banco ou ERP.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-lg lg:ms-auto">
              <div className="bg-primary/5 absolute -inset-4 -z-10 rounded-[2rem]" />
              <Card className="border-primary/10 shadow-primary/8 overflow-hidden py-0 shadow-2xl">
                <div className="bg-muted/40 flex items-center justify-between border-b px-5 py-4">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">
                      Resumo operacional
                    </p>
                    <p className="mt-0.5 text-sm font-semibold">
                      Julho de 2026
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    Em ordem
                  </span>
                </div>
                <CardContent className="space-y-3 p-5">
                  {[
                    ["Hoje", "Revisar vencimentos", "3 itens"],
                    ["Aprovações", "Aguardando responsáveis", "2 itens"],
                    ["Comprovantes", "Documentos centralizados", "Tudo certo"],
                  ].map(([eyebrow, title, status]) => (
                    <div
                      key={eyebrow}
                      className="bg-background flex items-center justify-between gap-5 rounded-xl border px-4 py-3.5"
                    >
                      <div>
                        <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                          {eyebrow}
                        </p>
                        <p className="mt-1 text-sm font-medium">{title}</p>
                      </div>
                      <span className="text-primary text-xs font-semibold whitespace-nowrap">
                        {status}
                      </span>
                    </div>
                  ))}
                  <p className="text-muted-foreground pt-2 text-center text-[11px]">
                    Visual ilustrativo da experiência do produto
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section
          id="como-funciona"
          className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24"
        >
          <div className="max-w-2xl">
            <p className="text-primary text-sm font-semibold">
              Menos ruído operacional
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Uma base confiável para o seu contas a pagar.
            </h2>
            <p className="text-muted-foreground mt-4 leading-7">
              Estruture o processo primeiro. Automatizações e integrações entram
              depois, com contexto e segurança.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {benefits.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="shadow-none">
                <CardContent className="p-6">
                  <span className="bg-primary/10 text-primary grid size-10 place-items-center rounded-xl">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 font-semibold">{title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">
                    {description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© 2026 Vencii. Organização financeira para empresas.</p>
          <p>Não somos banco e não executamos pagamentos.</p>
        </div>
      </footer>
    </div>
  );
}
