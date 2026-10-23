"use client";

import {
  AlertTriangle,
  FileText,
  LoaderCircle,
  UploadCloud,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type UploadState = "idle" | "uploading" | "processing" | "error";

interface UploadResponse {
  id: string;
  duplicate: boolean;
  message?: string;
}

export function DocumentUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  function choose(next: File | undefined) {
    if (!next) return;
    setFile(next);
    setMessage("");
    setState("idle");
    setProgress(0);
  }

  function send() {
    if (!file || state !== "idle") return;
    setState("uploading");
    const data = new FormData();
    data.set("file", file);
    const request = new XMLHttpRequest();
    request.open("POST", "/api/attachments");
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable)
        setProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", async () => {
      let result: UploadResponse;
      try {
        result = JSON.parse(request.responseText) as UploadResponse;
      } catch {
        setState("error");
        setMessage("O servidor retornou uma resposta inválida.");
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        setState("error");
        setMessage(result.message ?? "Não foi possível enviar o documento.");
        return;
      }
      setState("processing");
      const processed = await fetch(`/api/attachments/${result.id}/process`, {
        method: "POST",
      });
      if (!processed.ok) {
        const failure = (await processed.json()) as { message?: string };
        setState("error");
        setMessage(
          failure.message ?? "Não foi possível processar o documento.",
        );
        return;
      }
      const suffix = result.duplicate ? "?duplicate=1" : "";
      window.location.assign(
        `/app/contas-a-pagar/anexos/${result.id}/revisar${suffix}`,
      );
    });
    request.addEventListener("error", () => {
      setState("error");
      setMessage("A conexão foi interrompida durante o envio.");
    });
    request.send(data);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar documento</CardTitle>
        <CardDescription>
          Envie um boleto ou conta para revisar os dados antes do cadastro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            "border-border bg-muted/20 flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-colors",
            dragging && "border-primary bg-primary/5",
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            choose(event.dataTransfer.files[0]);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
            onChange={(event) => choose(event.target.files?.[0])}
          />
          <UploadCloud
            className="text-primary mb-3 size-7"
            aria-hidden="true"
          />
          <p className="font-medium">Arraste PDF, PNG ou JPEG aqui</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Até 10 MB. O arquivo permanece privado.
          </p>
          <Button
            className="mt-4"
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
          >
            Selecionar arquivo
          </Button>
        </div>

        {file && (
          <div className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
            <FileText
              className="text-primary size-5 shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-muted-foreground text-xs">
                {(file.size / 1024 / 1024).toLocaleString("pt-BR", {
                  maximumFractionDigits: 2,
                })}{" "}
                MB
              </p>
            </div>
            {state === "idle" && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remover arquivo"
                onClick={() => setFile(null)}
              >
                <X />
              </Button>
            )}
            <Button type="button" onClick={send} disabled={state !== "idle"}>
              {state === "uploading" || state === "processing" ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <UploadCloud />
              )}
              {state === "uploading"
                ? `Enviando ${progress}%`
                : state === "processing"
                  ? "Extraindo dados"
                  : "Enviar e revisar"}
            </Button>
          </div>
        )}

        {state === "uploading" && (
          <div
            className="bg-muted h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso do upload"
          >
            <div
              className="bg-primary h-full transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {state === "error" && (
          <div
            className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border p-3 text-sm"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
