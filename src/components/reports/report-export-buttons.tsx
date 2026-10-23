"use client";

import { useState } from "react";
import { Download, FileText, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportExportButtons({ query }: { query: string }) {
  const [loading, setLoading] = useState<"csv" | "pdf" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function download(format: "csv" | "pdf") {
    setLoading(format);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/reports/export?${query}&format=${format}`,
      );
      if (response.status === 202) {
        const result = (await response.json()) as { message: string };
        setMessage(result.message);
        return;
      }
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = match?.[1] ?? `relatorio.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage("Não foi possível gerar a exportação.");
    } finally {
      setLoading(null);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => download("csv")}
        disabled={loading !== null}
      >
        {loading === "csv" ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <Download />
        )}
        Exportar CSV
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => download("pdf")}
        disabled={loading !== null}
      >
        {loading === "pdf" ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <FileText />
        )}
        Exportar PDF
      </Button>
      {message && (
        <p className="text-muted-foreground basis-full text-xs" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
