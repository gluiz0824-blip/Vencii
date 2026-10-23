import { Skeleton } from "@/components/ui/skeleton";
export default function LoadingPage() {
  return (
    <main
      className="mx-auto w-full max-w-7xl space-y-5 px-5 py-20"
      aria-label="Carregando"
    >
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-72 w-full" />
    </main>
  );
}
