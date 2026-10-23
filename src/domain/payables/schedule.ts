import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  parse,
} from "date-fns";

import { businessDate, type BusinessDate } from "@/domain/shared/business-date";

export type CreationMode = "single" | "installments" | "recurring";
export type RecurrenceFrequency = "weekly" | "monthly" | "yearly" | "custom";

export interface ScheduleInput {
  mode: CreationMode;
  firstDueDate: BusinessDate;
  installmentCount?: number;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceCount?: number;
  recurrenceEndDate?: BusinessDate;
  customIntervalDays?: number;
}

export interface ScheduleOccurrence {
  index: number;
  dueDate: BusinessDate;
  installmentNumber: number | null;
  installmentTotal: number | null;
}

const DATE_FORMAT = "yyyy-MM-dd";

function parseDate(value: BusinessDate): Date {
  return parse(value, DATE_FORMAT, new Date(2000, 0, 1));
}

function toBusinessDate(value: Date): BusinessDate {
  return businessDate(format(value, DATE_FORMAT));
}

function addFrequency(
  value: Date,
  frequency: RecurrenceFrequency,
  customIntervalDays: number,
): Date {
  if (frequency === "weekly") return addWeeks(value, 1);
  if (frequency === "monthly") return addMonths(value, 1);
  if (frequency === "yearly") return addYears(value, 1);
  return addDays(value, customIntervalDays);
}

export function generatePayableSchedule(
  input: ScheduleInput,
): ScheduleOccurrence[] {
  if (input.mode === "single") {
    return [
      {
        index: 1,
        dueDate: input.firstDueDate,
        installmentNumber: null,
        installmentTotal: null,
      },
    ];
  }

  if (input.mode === "installments") {
    const total = input.installmentCount ?? 0;
    if (!Number.isInteger(total) || total < 2 || total > 360) {
      throw new TypeError("A quantidade de parcelas deve ficar entre 2 e 360.");
    }

    const firstDate = parseDate(input.firstDueDate);
    return Array.from({ length: total }, (_, position) => ({
      index: position + 1,
      dueDate: toBusinessDate(addMonths(firstDate, position)),
      installmentNumber: position + 1,
      installmentTotal: total,
    }));
  }

  const frequency = input.recurrenceFrequency ?? "monthly";
  const maximum = input.recurrenceCount ?? 120;
  const customDays = input.customIntervalDays ?? 1;
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 360) {
    throw new TypeError("A recorrência deve ter entre 1 e 360 ocorrências.");
  }
  if (
    frequency === "custom" &&
    (!Number.isInteger(customDays) || customDays < 1 || customDays > 365)
  ) {
    throw new TypeError(
      "O intervalo personalizado deve ficar entre 1 e 365 dias.",
    );
  }

  const endDate = input.recurrenceEndDate;
  const occurrences: ScheduleOccurrence[] = [];
  let current = parseDate(input.firstDueDate);

  while (occurrences.length < maximum) {
    const dueDate = toBusinessDate(current);
    if (endDate && dueDate > endDate) break;
    occurrences.push({
      index: occurrences.length + 1,
      dueDate,
      installmentNumber: null,
      installmentTotal: null,
    });
    current = addFrequency(current, frequency, customDays);
  }

  if (occurrences.length === 0) {
    throw new TypeError("A recorrência não gerou nenhuma ocorrência válida.");
  }

  return occurrences;
}
