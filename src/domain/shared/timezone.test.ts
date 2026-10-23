import { describe, expect, it } from "vitest";

import { todayInTimeZone } from "./timezone";

describe("todayInTimeZone", () => {
  it("respeita a data de negócio da organização", () => {
    const instant = new Date("2026-07-15T02:00:00.000Z");
    expect(todayInTimeZone("America/Sao_Paulo", instant)).toBe("2026-07-14");
  });
});
