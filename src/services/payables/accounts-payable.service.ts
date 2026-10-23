import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { businessDate } from "@/domain/shared/business-date";
import { canEditFinancialFields } from "@/domain/payables/payable";
import { generatePayableSchedule } from "@/domain/payables/schedule";
import {
  findAccountPayable,
  findAccountsByIdempotencyKey,
  findProbableDuplicates,
  insertAccountsPayable,
  updateAccountPayable,
} from "@/repositories/accounts-payable-server.repository";
import type { Database } from "@/types/database";
import {
  parseBrlAmountToCents,
  type PayableFormValues,
} from "@/validation/payable";

type PayableInsert = Database["public"]["Tables"]["accounts_payable"]["Insert"];

export interface CreatePayableResult {
  ids: string[];
  duplicateDescriptions: string[];
}

function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizedBarcode(value: string): string | null {
  const normalized = value.replace(/\s/g, "");
  return normalized || null;
}

function documentHash(values: PayableFormValues): string | null {
  const identity = [
    values.documentType,
    values.documentNumber.trim(),
    values.barcode.replace(/\s/g, ""),
    values.pixCode.trim(),
  ]
    .filter(Boolean)
    .join("|")
    .toLocaleLowerCase("pt-BR");
  return identity ? createHash("sha256").update(identity).digest("hex") : null;
}

export async function createAccountsPayable(input: {
  organizationId: string;
  userId: string;
  values: PayableFormValues;
  confirmDuplicates: boolean;
  source?: PayableInsert["source"];
}): Promise<CreatePayableResult> {
  const { organizationId, userId, values } = input;
  const existing = await findAccountsByIdempotencyKey(
    organizationId,
    values.idempotencyKey,
  );
  if (existing.length > 0) return { ids: existing, duplicateDescriptions: [] };

  const schedule = generatePayableSchedule({
    mode: values.mode,
    firstDueDate: businessDate(values.dueDate),
    installmentCount: values.installmentCount,
    recurrenceFrequency: values.recurrenceFrequency,
    recurrenceCount: values.recurrenceCount,
    recurrenceEndDate: values.recurrenceEndDate
      ? businessDate(values.recurrenceEndDate)
      : undefined,
    customIntervalDays: values.customIntervalDays,
  });
  const amountCents = parseBrlAmountToCents(values.amount);
  const hash = documentHash(values);
  const barcode = normalizedBarcode(values.barcode);
  const duplicates = await findProbableDuplicates(organizationId, {
    supplierId: optional(values.supplierId),
    amountCents,
    dueDates: schedule.map(({ dueDate }) => dueDate),
    barcode,
    documentHash: hash,
  });

  if (duplicates.length > 0 && !input.confirmDuplicates) {
    return {
      ids: [],
      duplicateDescriptions: duplicates.map(
        ({ description, due_date }) => `${description} — ${due_date}`,
      ),
    };
  }

  const recurrenceGroupId = values.mode === "single" ? null : randomUUID();
  const records: PayableInsert[] = schedule.map((occurrence) => ({
    organization_id: organizationId,
    supplier_id: optional(values.supplierId),
    expense_category_id: optional(values.expenseCategoryId),
    description: values.description.trim(),
    document_type: values.documentType,
    document_number: optional(values.documentNumber),
    barcode,
    pix_code: optional(values.pixCode),
    document_hash: hash,
    amount_cents: amountCents,
    issue_date: optional(values.issueDate),
    due_date: occurrence.dueDate,
    competence_date: optional(values.competenceDate),
    status: "pending",
    notes: optional(values.notes),
    recurrence_group_id: recurrenceGroupId,
    installment_number: occurrence.installmentNumber,
    installment_total: occurrence.installmentTotal,
    source: input.source ?? "manual",
    idempotency_key: values.idempotencyKey,
    occurrence_index: occurrence.index,
    created_by: userId,
    updated_by: userId,
  }));

  const ids = await insertAccountsPayable(
    organizationId,
    values.idempotencyKey,
    records,
  );
  return { ids, duplicateDescriptions: [] };
}

export async function updateExistingAccountPayable(input: {
  organizationId: string;
  accountId: string;
  userId: string;
  values: Omit<
    PayableFormValues,
    | "mode"
    | "installmentCount"
    | "recurrenceFrequency"
    | "recurrenceCount"
    | "recurrenceEndDate"
    | "customIntervalDays"
    | "idempotencyKey"
  >;
  confirmDuplicates: boolean;
}): Promise<string[]> {
  const current = await findAccountPayable(
    input.organizationId,
    input.accountId,
  );
  if (!current) throw new Error("Conta não encontrada.");

  if (!canEditFinancialFields(current.status)) {
    await updateAccountPayable(input.organizationId, input.accountId, {
      notes: optional(input.values.notes),
      updated_by: input.userId,
    });
    return [];
  }

  const amountCents = parseBrlAmountToCents(input.values.amount);
  const hash = documentHash({
    ...input.values,
    mode: "single",
    installmentCount: 2,
    recurrenceFrequency: "monthly",
    recurrenceCount: 1,
    recurrenceEndDate: "",
    customIntervalDays: 30,
    idempotencyKey: "update-existing-account",
  });
  const duplicates = await findProbableDuplicates(input.organizationId, {
    supplierId: optional(input.values.supplierId),
    amountCents,
    dueDates: [input.values.dueDate],
    barcode: normalizedBarcode(input.values.barcode),
    documentHash: hash,
    excludedId: input.accountId,
  });
  if (duplicates.length > 0 && !input.confirmDuplicates) {
    return duplicates.map(
      ({ description, due_date }) => `${description} — ${due_date}`,
    );
  }

  await updateAccountPayable(input.organizationId, input.accountId, {
    supplier_id: optional(input.values.supplierId),
    expense_category_id: optional(input.values.expenseCategoryId),
    description: input.values.description.trim(),
    document_type: input.values.documentType,
    document_number: optional(input.values.documentNumber),
    barcode: normalizedBarcode(input.values.barcode),
    pix_code: optional(input.values.pixCode),
    document_hash: hash,
    amount_cents: amountCents,
    issue_date: optional(input.values.issueDate),
    due_date: input.values.dueDate,
    competence_date: optional(input.values.competenceDate),
    notes: optional(input.values.notes),
    updated_by: input.userId,
  });
  return [];
}
