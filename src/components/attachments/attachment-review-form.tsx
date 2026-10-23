"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  LoaderCircle,
  RotateCw,
} from "lucide-react";
import { useActionState, useState } from "react";

import {
  reviewAttachmentAction,
  type AttachmentReviewState,
} from "@/app/actions/attachments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  DocumentExtractionData,
  ExtractedFieldName,
} from "@/domain/attachments/document";

interface AccountOption {
  id: string;
  description: string;
  dueDate: string;
}

interface Props {
  attachmentId: string;
  originalName: string;
  mimeType: string;
  previewUrl: string;
  extraction: DocumentExtractionData | null;
  accounts: AccountOption[];
  duplicate: boolean;
  extractionFailed: boolean;
  extractionOutdated: boolean;
}

const initialState: AttachmentReviewState = { status: "idle" };

function extracted(
  data: DocumentExtractionData | null,
  name: ExtractedFieldName,
) {
  return data?.candidates[name];
}

function confidenceClass(confidence?: number) {
  return confidence !== undefined && confidence < 0.7
    ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
    : "";
}

function brl(cents: string | number | undefined): string {
  return typeof cents === "number"
    ? (cents / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "";
}

export function AttachmentReviewForm(props: Props) {
  const action = reviewAttachmentAction.bind(null, props.attachmentId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [retrying, setRetrying] = useState(false);
  const field = (name: ExtractedFieldName) => extracted(props.extraction, name);
  const defaults = {
    supplierName: String(field("supplierName")?.value ?? ""),
    taxId: String(field("taxId")?.value ?? ""),
    amount: brl(field("amountCents")?.value),
    issueDate: String(field("issueDate")?.value ?? ""),
    dueDate: String(field("dueDate")?.value ?? ""),
    barcode: String(field("barcode")?.value ?? ""),
    pixCode: String(field("pixCode")?.value ?? ""),
    documentNumber: String(field("documentNumber")?.value ?? ""),
  };

  async function retryExtraction() {
    setRetrying(true);
    try {
      await fetch(`/api/attachments/${props.attachmentId}/process`, {
        method: "POST",
      });
      window.location.reload();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <form action={formAction} className="grid min-w-0 gap-6 xl:grid-cols-2">
      <section
        className="min-w-0 space-y-3"
        aria-labelledby="document-preview-title"
      >
        <div>
          <h2
            id="document-preview-title"
            className="font-heading text-lg font-semibold"
          >
            Documento original
          </h2>
          <p className="text-muted-foreground truncate text-sm">
            {props.originalName}
          </p>
        </div>
        <div className="bg-muted flex min-h-[520px] items-center justify-center overflow-hidden rounded-xl border">
          {props.mimeType === "application/pdf" ? (
            <iframe
              src={props.previewUrl}
              title={`Pré-visualização de ${props.originalName}`}
              className="h-[70vh] min-h-[520px] w-full"
            />
          ) : (
            // A origem é uma URL assinada, privada e temporária do Supabase.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={props.previewUrl}
              alt={`Documento ${props.originalName}`}
              className="max-h-[70vh] w-full object-contain"
            />
          )}
        </div>
      </section>

      <section
        className="min-w-0 space-y-5"
        aria-labelledby="review-fields-title"
      >
        <div>
          <h2
            id="review-fields-title"
            className="font-heading text-lg font-semibold"
          >
            Confirme os dados
          </h2>
          <p className="text-muted-foreground text-sm">
            Nada será cadastrado sem a sua confirmação.
          </p>
        </div>

        {(props.duplicate ||
          props.extractionFailed ||
          props.extraction?.method === "manual") && (
          <div
            className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
            role="status"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              {props.duplicate
                ? "Este arquivo já foi enviado nesta organização. Revise o documento existente antes de continuar."
                : "A extração automática não está disponível para este arquivo. Preencha os dados manualmente."}
            </span>
          </div>
        )}

        {(props.extractionFailed || props.extractionOutdated) && (
          <Button
            type="button"
            variant="outline"
            onClick={retryExtraction}
            disabled={retrying}
          >
            {retrying ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <RotateCw />
            )}
            {props.extractionOutdated
              ? "Reanalisar e preencher os campos"
              : "Tentar extração novamente"}
          </Button>
        )}

        <input type="hidden" name="mode" value={mode} />
        <div
          className="bg-muted grid grid-cols-2 gap-2 rounded-xl p-1"
          aria-label="Destino do documento"
        >
          <Button
            type="button"
            variant={mode === "new" ? "default" : "ghost"}
            aria-pressed={mode === "new"}
            onClick={() => setMode("new")}
          >
            Criar nova conta
          </Button>
          <Button
            type="button"
            variant={mode === "existing" ? "default" : "ghost"}
            aria-pressed={mode === "existing"}
            onClick={() => setMode("existing")}
          >
            Vincular existente
          </Button>
        </div>

        {mode === "existing" ? (
          <Field
            htmlFor="accountPayableId"
            label="Conta existente"
            error={state.fieldErrors?.accountPayableId?.[0]}
          >
            <select
              id="accountPayableId"
              name="accountPayableId"
              defaultValue=""
              className="border-input bg-background h-9 w-full rounded-lg border px-3 text-sm"
              required
            >
              <option value="">Selecione uma conta</option>
              {props.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.description} — {account.dueDate}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <input type="hidden" name="accountPayableId" value="" />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            htmlFor="description"
            label="Descrição"
            error={state.fieldErrors?.description?.[0]}
            className="sm:col-span-2"
          >
            <Input
              id="description"
              name="description"
              defaultValue={
                defaults.supplierName ||
                props.originalName.replace(/\.[^.]+$/, "")
              }
              required
            />
          </Field>
          <Field
            htmlFor="supplierName"
            label="Fornecedor identificado"
            low={field("supplierName")?.confidence}
            error={state.fieldErrors?.supplierName?.[0]}
          >
            <Input
              id="supplierName"
              name="supplierName"
              defaultValue={defaults.supplierName}
              className={confidenceClass(field("supplierName")?.confidence)}
            />
          </Field>
          <Field
            htmlFor="taxId"
            label="CNPJ ou CPF"
            low={field("taxId")?.confidence}
            error={state.fieldErrors?.taxId?.[0]}
          >
            <Input
              id="taxId"
              name="taxId"
              defaultValue={defaults.taxId}
              className={confidenceClass(field("taxId")?.confidence)}
            />
          </Field>
          <Field
            htmlFor="amount"
            label="Valor"
            low={field("amountCents")?.confidence}
            error={state.fieldErrors?.amount?.[0]}
          >
            <Input
              id="amount"
              name="amount"
              defaultValue={defaults.amount}
              placeholder="0,00"
              required
              className={confidenceClass(field("amountCents")?.confidence)}
            />
          </Field>
          <Field
            htmlFor="dueDate"
            label="Vencimento"
            low={field("dueDate")?.confidence}
            error={state.fieldErrors?.dueDate?.[0]}
          >
            <Input
              id="dueDate"
              name="dueDate"
              type="date"
              defaultValue={defaults.dueDate}
              required
              className={confidenceClass(field("dueDate")?.confidence)}
            />
          </Field>
          <Field
            htmlFor="issueDate"
            label="Emissão"
            low={field("issueDate")?.confidence}
            error={state.fieldErrors?.issueDate?.[0]}
          >
            <Input
              id="issueDate"
              name="issueDate"
              type="date"
              defaultValue={defaults.issueDate}
              className={confidenceClass(field("issueDate")?.confidence)}
            />
          </Field>
          <Field
            htmlFor="documentNumber"
            label="Número do documento"
            low={field("documentNumber")?.confidence}
            error={state.fieldErrors?.documentNumber?.[0]}
          >
            <Input
              id="documentNumber"
              name="documentNumber"
              defaultValue={defaults.documentNumber}
              className={confidenceClass(field("documentNumber")?.confidence)}
            />
          </Field>
          <Field
            htmlFor="barcode"
            label="Linha digitável"
            low={field("barcode")?.confidence}
            error={state.fieldErrors?.barcode?.[0]}
            className="sm:col-span-2"
          >
            <Input
              id="barcode"
              name="barcode"
              defaultValue={defaults.barcode}
              className={confidenceClass(field("barcode")?.confidence)}
              aria-describedby={
                field("barcode")?.valid === false
                  ? "barcode-warning"
                  : undefined
              }
            />
            {field("barcode")?.valid === false && (
              <p
                id="barcode-warning"
                className="mt-1 text-xs text-amber-700 dark:text-amber-300"
              >
                Os dígitos verificadores não puderam ser validados.
              </p>
            )}
          </Field>
          <Field
            htmlFor="pixCode"
            label="Código Pix"
            low={field("pixCode")?.confidence}
            error={state.fieldErrors?.pixCode?.[0]}
            className="sm:col-span-2"
          >
            <Input
              id="pixCode"
              name="pixCode"
              defaultValue={defaults.pixCode}
              className={confidenceClass(field("pixCode")?.confidence)}
            />
          </Field>
        </div>

        {state.status === "error" && state.message && (
          <p className="text-destructive text-sm" role="alert">
            {state.message}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          <CheckCircle2 />{" "}
          {pending
            ? "Salvando revisão"
            : mode === "new"
              ? "Confirmar e criar conta"
              : "Confirmar vínculo"}
        </Button>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <FileSearch className="size-4" /> Campos em amarelo precisam de
          atenção especial.
        </p>
      </section>
    </form>
  );
}

function Field({
  htmlFor,
  label,
  children,
  error,
  low,
  className,
}: {
  htmlFor: string;
  label: string;
  children: React.ReactNode;
  error?: string;
  low?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-2">
        {label}
        {low !== undefined && low < 0.7 && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            Baixa confiança
          </span>
        )}
      </Label>
      {children}
      {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
    </div>
  );
}
