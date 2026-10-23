import { describe, expect, it } from "vitest";

import { formatMoney, moneyInCents } from "./money";

describe("moneyInCents", () => {
  it("aceita apenas inteiros seguros", () => {
    expect(moneyInCents(1099)).toBe(1099);
    expect(() => moneyInCents(10.99)).toThrow(TypeError);
  });

  it("formata centavos em reais", () => {
    expect(formatMoney(moneyInCents(1099))).toContain("10,99");
  });
});
