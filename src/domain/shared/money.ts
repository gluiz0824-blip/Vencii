export type MoneyInCents = number & { readonly __brand: "MoneyInCents" };

export function moneyInCents(value: number): MoneyInCents {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(
      "O valor monetário deve ser um inteiro seguro em centavos.",
    );
  }

  return value as MoneyInCents;
}

export function formatMoney(value: MoneyInCents): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}
