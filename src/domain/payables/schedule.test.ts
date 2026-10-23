import { describe, expect, it } from "vitest";

import { businessDate } from "@/domain/shared/business-date";

import { generatePayableSchedule } from "./schedule";

describe("generatePayableSchedule", () => {
  it("gera uma conta simples", () => {
    expect(
      generatePayableSchedule({
        mode: "single",
        firstDueDate: businessDate("2026-07-15"),
      }),
    ).toHaveLength(1);
  });

  it("gera parcelas mensais individuais", () => {
    const result = generatePayableSchedule({
      mode: "installments",
      firstDueDate: businessDate("2026-01-31"),
      installmentCount: 3,
    });

    expect(result.map(({ dueDate }) => dueDate)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
    expect(result[2]?.installmentNumber).toBe(3);
  });

  it("limita recorrência pela data final", () => {
    const result = generatePayableSchedule({
      mode: "recurring",
      firstDueDate: businessDate("2026-01-10"),
      recurrenceFrequency: "weekly",
      recurrenceCount: 20,
      recurrenceEndDate: businessDate("2026-01-31"),
    });

    expect(result.map(({ dueDate }) => dueDate)).toEqual([
      "2026-01-10",
      "2026-01-17",
      "2026-01-24",
      "2026-01-31",
    ]);
  });

  it("gera recorrência por intervalo personalizado", () => {
    const result = generatePayableSchedule({
      mode: "recurring",
      firstDueDate: businessDate("2026-07-01"),
      recurrenceFrequency: "custom",
      recurrenceCount: 3,
      customIntervalDays: 10,
    });

    expect(result.map(({ dueDate }) => dueDate)).toEqual([
      "2026-07-01",
      "2026-07-11",
      "2026-07-21",
    ]);
  });
});
