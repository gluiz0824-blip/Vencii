import { businessDate, type BusinessDate } from "./business-date";

export function todayInTimeZone(
  timeZone: string,
  now: Date = new Date(),
): BusinessDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return businessDate(`${get("year")}-${get("month")}-${get("day")}`);
}
