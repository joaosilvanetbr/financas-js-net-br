import { monthKey } from "./finance";

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function shiftMonthKey(value: string, delta: number) {
  const [yearText, monthText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return monthKey();

  const totalMonths = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = String((totalMonths % 12) + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
}

export function replaceItemById<T extends { id: string }>(items: T[], nextItem: T) {
  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

export function isDuplicateCategoryError(error: any) {
  const msg = error?.error || error?.message || String(error);
  return typeof msg === "string" && /unique|duplicate/i.test(msg);
}
