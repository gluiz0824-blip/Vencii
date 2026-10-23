"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CalendarRange, LoaderCircle, Save } from "lucide-react";
import { startTransition, useActionState, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import type { PayableActionState } from "@/app/actions/accounts-payable";
import { CurrencyDisplay } from "@/components/product/currency-display";
import { DateDisplay } from "@/components/product/date-display";
import { ResponsiveFormLayout } from "@/components/product/responsive-form-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PAYABLE_DOCUMENT_LABELS } from "@/domain/payables/payable";
import { generatePayableSchedule } from "@/domain/payables/schedule";
import { businessDate } from "@/domain/shared/business-date";
import { moneyInCents } from "@/domain/shared/money";
import type { PayableDocumentType } from "@/types/database";
import {
  parseBrlAmountToCents,
  payableFormSchema,
  type PayableFormValues,
} from "@/validation/payable";

interface LookupOption {
  id: string;
  name: string;
}

interface PayableFormProps {
  action: (
    state: PayableActionState,
    formData: FormData,
  ) => Promise<PayableActionState>;
  suppliers: LookupOption[];
  categories: LookupOption[];
  defaultValues: PayableFormValues;
  submitLabel: string;
  financialLocked?: boolean;
  showSchedule?: boolean;
}

const INITIAL_PAYABLE_ACTION_STATE: PayableActionState = { status: "idle" };

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-destructive mt-1 text-xs" role="alert">
      {message}
    </p>
  ) : null;
}

function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return (Number(digits || "0") / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PayableForm({
  action,
  suppliers,
  categories,
  defaultValues,
  submitLabel,
  financialLocked = false,
  showSchedule = true,
}: PayableFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_PAYABLE_ACTION_STATE,
  );
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PayableFormValues>({
    resolver: zodResolver(payableFormSchema),
    defaultValues,
  });
  const values = useWatch({ control }) as PayableFormValues;

  const preview = useMemo(() => {
    try {
      if (!values.dueDate) return [];
      return generatePayableSchedule({
        mode: showSchedule ? values.mode : "single",
        firstDueDate: businessDate(values.dueDate),
        installmentCount: values.installmentCount,
        recurrenceFrequency: values.recurrenceFrequency,
        recurrenceCount: values.recurrenceCount,
        recurrenceEndDate: values.recurrenceEndDate
          ? businessDate(values.recurrenceEndDate)
          : undefined,
        customIntervalDays: values.customIntervalDays,
      });
    } catch {
      return [];
    }
  }, [showSchedule, values]);

  function submit(
    valuesToSubmit: PayableFormValues,
    confirmDuplicates: boolean,
  ) {
    const formData = new FormData();
    Object.entries(valuesToSubmit).forEach(([key, value]) =>
      formData.set(key, String(value ?? "")),
    );
    formData.set("confirmDuplicates", String(confirmDuplicates));
    startTransition(() => formAction(formData));
  }

  const documentType = values.documentType;

  return (
    <form onSubmit={handleSubmit((data) => submit(data, false))} noValidate>
      <ResponsiveFormLayout
        aside={
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarRange
                    className="text-primary size-4"
                    aria-hidden="true"
                  />
                  Prévia do lançamento
                </CardTitle>
                <CardDescription>
                  Cada vencimento será salvo como uma conta individual.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {preview.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-muted-foreground text-xs">
                          Ocorrências
                        </p>
                        <p className="text-2xl font-semibold">
                          {preview.length}
                        </p>
                      </div>
                      {values.amount && (
                        <CurrencyDisplay
                          value={moneyInCents(
                            (() => {
                              try {
                                return parseBrlAmountToCents(values.amount);
                              } catch {
                                return 0;
                              }
                            })(),
                          )}
                        />
                      )}
                    </div>
                    <ol className="max-h-56 space-y-2 overflow-y-auto border-t pt-3">
                      {preview.slice(0, 12).map((occurrence) => (
                        <li
                          key={occurrence.index}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span>
                            {occurrence.installmentNumber
                              ? `Parcela ${occurrence.installmentNumber}/${occurrence.installmentTotal}`
                              : `Ocorrência ${occurrence.index}`}
                          </span>
                          <DateDisplay value={occurrence.dueDate} />
                        </li>
                      ))}
                    </ol>
                    {preview.length > 12 && (
                      <p className="text-muted-foreground text-xs">
                        Mais {preview.length - 12} ocorrências serão criadas.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Informe um vencimento válido para visualizar a prévia.
                  </p>
                )}
              </CardContent>
            </Card>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={pending}
            >
              {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
              {pending ? "Salvando…" : submitLabel}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {financialLocked && (
            <div className="border-status-pending/30 bg-status-pending-muted text-status-pending-foreground rounded-xl border p-4 text-sm">
              Esta conta foi finalizada. Somente as observações podem ser
              alteradas.
            </div>
          )}

          {state.status !== "idle" && (
            <div
              className={
                state.status === "duplicate"
                  ? "border-status-pending/30 bg-status-pending-muted text-status-pending-foreground rounded-xl border p-4"
                  : "border-destructive/30 bg-destructive/10 text-destructive rounded-xl border p-4"
              }
              role="alert"
              aria-live="polite"
            >
              <div className="flex gap-3">
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {state.message ?? "Revise os campos informados."}
                  </p>
                  {state.duplicates && (
                    <ul className="mt-2 list-disc space-y-1 ps-4">
                      {state.duplicates.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                  {state.status === "duplicate" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      disabled={pending}
                      onClick={handleSubmit((data) => submit(data, true))}
                    >
                      Confirmar mesmo assim
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Dados principais</CardTitle>
              <CardDescription>
                Identificação, responsável e valor da obrigação.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-1 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  className="mt-1.5 w-full"
                  readOnly={financialLocked}
                  aria-invalid={Boolean(errors.description)}
                  {...register("description")}
                />
                <FieldError message={errors.description?.message} />
              </div>

              <div>
                <Label htmlFor="supplierId">Fornecedor</Label>
                <Controller
                  control={control}
                  name="supplierId"
                  render={({ field }) => (
                    <Select
                      value={field.value || "none"}
                      onValueChange={(value) =>
                        field.onChange(value === "none" ? "" : value)
                      }
                      disabled={financialLocked}
                    >
                      <SelectTrigger id="supplierId" className="mt-1.5 w-full">
                        <SelectValue placeholder="Sem fornecedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem fornecedor</SelectItem>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Label htmlFor="expenseCategoryId">Categoria</Label>
                <Controller
                  control={control}
                  name="expenseCategoryId"
                  render={({ field }) => (
                    <Select
                      value={field.value || "none"}
                      onValueChange={(value) =>
                        field.onChange(value === "none" ? "" : value)
                      }
                      disabled={financialLocked}
                    >
                      <SelectTrigger
                        id="expenseCategoryId"
                        className="mt-1.5 w-full"
                      >
                        <SelectValue placeholder="Sem categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem categoria</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Label htmlFor="documentType">Tipo de documento</Label>
                <Controller
                  control={control}
                  name="documentType"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={financialLocked}
                    >
                      <SelectTrigger
                        id="documentType"
                        className="mt-1.5 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.keys(
                            PAYABLE_DOCUMENT_LABELS,
                          ) as PayableDocumentType[]
                        ).map((type) => (
                          <SelectItem key={type} value={type}>
                            {PAYABLE_DOCUMENT_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Label htmlFor="amount">Valor</Label>
                <Controller
                  control={control}
                  name="amount"
                  render={({ field }) => (
                    <Input
                      id="amount"
                      inputMode="numeric"
                      className="mt-1.5 w-full"
                      disabled={financialLocked}
                      aria-invalid={Boolean(errors.amount)}
                      value={field.value}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      onChange={(event) =>
                        field.onChange(formatCurrencyInput(event.target.value))
                      }
                    />
                  )}
                />
                <FieldError message={errors.amount?.message} />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="documentNumber">Número do documento</Label>
                <Input
                  id="documentNumber"
                  className="mt-1.5 w-full"
                  readOnly={financialLocked}
                  {...register("documentNumber")}
                />
              </div>

              {documentType === "boleto" && (
                <div className="sm:col-span-2">
                  <Label htmlFor="barcode">Linha digitável</Label>
                  <Input
                    id="barcode"
                    className="mt-1.5 w-full font-mono"
                    readOnly={financialLocked}
                    {...register("barcode")}
                  />
                </div>
              )}

              {documentType === "pix" && (
                <div className="sm:col-span-2">
                  <Label htmlFor="pixCode">Código Pix</Label>
                  <Textarea
                    id="pixCode"
                    className="mt-1.5 min-h-20 font-mono text-xs"
                    readOnly={financialLocked}
                    {...register("pixCode")}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Datas e organização</CardTitle>
              <CardDescription>
                Datas são tratadas sem conversão de fuso horário.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-1 sm:grid-cols-3">
              <div>
                <Label htmlFor="issueDate">Emissão</Label>
                <Input
                  id="issueDate"
                  type="date"
                  className="mt-1.5 w-full"
                  readOnly={financialLocked}
                  {...register("issueDate")}
                />
                <FieldError message={errors.issueDate?.message} />
              </div>
              <div>
                <Label htmlFor="dueDate">Vencimento</Label>
                <Input
                  id="dueDate"
                  type="date"
                  className="mt-1.5 w-full"
                  readOnly={financialLocked}
                  aria-invalid={Boolean(errors.dueDate)}
                  {...register("dueDate")}
                />
                <FieldError message={errors.dueDate?.message} />
              </div>
              <div>
                <Label htmlFor="competenceDate">Competência</Label>
                <Input
                  id="competenceDate"
                  type="date"
                  className="mt-1.5 w-full"
                  readOnly={financialLocked}
                  {...register("competenceDate")}
                />
              </div>
            </CardContent>
          </Card>

          {showSchedule && (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Parcelamento ou recorrência</CardTitle>
                <CardDescription>
                  Escolha uma única forma de repetição para este cadastro.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 pt-1 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="mode">Forma de criação</Label>
                  <Controller
                    control={control}
                    name="mode"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="mode" className="mt-1.5 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Conta única</SelectItem>
                          <SelectItem value="installments">
                            Parcelar mensalmente
                          </SelectItem>
                          <SelectItem value="recurring">
                            Criar recorrência
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {values.mode === "installments" && (
                  <div>
                    <Label htmlFor="installmentCount">
                      Quantidade de parcelas
                    </Label>
                    <Input
                      id="installmentCount"
                      type="number"
                      min={2}
                      max={360}
                      className="mt-1.5 w-full"
                      {...register("installmentCount", { valueAsNumber: true })}
                    />
                  </div>
                )}

                {values.mode === "recurring" && (
                  <>
                    <div>
                      <Label htmlFor="recurrenceFrequency">Frequência</Label>
                      <Controller
                        control={control}
                        name="recurrenceFrequency"
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger
                              id="recurrenceFrequency"
                              className="mt-1.5 w-full"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="weekly">Semanal</SelectItem>
                              <SelectItem value="monthly">Mensal</SelectItem>
                              <SelectItem value="yearly">Anual</SelectItem>
                              <SelectItem value="custom">
                                Intervalo personalizado
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div>
                      <Label htmlFor="recurrenceCount">
                        Quantidade de ocorrências
                      </Label>
                      <Input
                        id="recurrenceCount"
                        type="number"
                        min={1}
                        max={360}
                        className="mt-1.5 w-full"
                        {...register("recurrenceCount", {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                    {values.recurrenceFrequency === "custom" && (
                      <div>
                        <Label htmlFor="customIntervalDays">
                          Intervalo em dias
                        </Label>
                        <Input
                          id="customIntervalDays"
                          type="number"
                          min={1}
                          max={365}
                          className="mt-1.5 w-full"
                          {...register("customIntervalDays", {
                            valueAsNumber: true,
                          })}
                        />
                      </div>
                    )}
                    <div>
                      <Label htmlFor="recurrenceEndDate">
                        Data final opcional
                      </Label>
                      <Input
                        id="recurrenceEndDate"
                        type="date"
                        className="mt-1.5 w-full"
                        {...register("recurrenceEndDate")}
                      />
                      <FieldError message={errors.recurrenceEndDate?.message} />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Observações</CardTitle>
              <CardDescription>
                Contexto interno para consulta e auditoria.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-1">
              <Label htmlFor="notes">Observações internas</Label>
              <Textarea
                id="notes"
                className="mt-1.5 min-h-28"
                aria-invalid={Boolean(errors.notes)}
                {...register("notes")}
              />
              <FieldError message={errors.notes?.message} />
            </CardContent>
          </Card>

          <input type="hidden" {...register("idempotencyKey")} />
        </div>
      </ResponsiveFormLayout>
    </form>
  );
}
