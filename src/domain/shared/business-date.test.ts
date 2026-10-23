import { describe, expect, it } from "vitest";

import { businessDate, formatBusinessDate } from "./business-date";

describe("businessDate", () => {
  it("preserva uma data de negócio sem conversão de fuso", () => {
    const dueDate = businessDate("2026-07-15");

    expect(dueDate).toBe("2026-07-15");
    expect(formatBusinessDate(dueDate)).toBe("15/07/2026");
  });

  it("rejeita datas inexistentes", () => {
    expect(() => businessDate("2026-02-30")).toThrow(TypeError);
  });
});
