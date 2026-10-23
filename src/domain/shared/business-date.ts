import { format, isValid, parse } from "date-fns";

export type BusinessDate = string & { readonly __brand: "BusinessDate" };

const BUSINESS_DATE_FORMAT = "yyyy-MM-dd";

export function businessDate(value: string): BusinessDate {
  const parsed = parse(value, BUSINESS_DATE_FORMAT, new Date(2000, 0, 1));

  if (!isValid(parsed) || format(parsed, BUSINESS_DATE_FORMAT) !== value) {
    throw new TypeError("A data de negócio deve usar o formato AAAA-MM-DD.");
  }

  return value as BusinessDate;
}

export function formatBusinessDate(value: BusinessDate): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
