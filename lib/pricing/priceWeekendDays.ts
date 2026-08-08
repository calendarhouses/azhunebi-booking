/**
 * Days that use the higher («вихідні») room tariff.
 * Values match `Date.getDay()`: 0 = Нд … 6 = Сб.
 *
 * Default keeps historical platform behavior: пт + сб + нд.
 * Owners can narrow to e.g. [5, 6] (пт+сб) so нд–чт use the cheaper rate.
 */
export const DEFAULT_PRICE_WEEKEND_DAYS: readonly number[] = [5, 6, 0];

export const PRICE_WEEKDAY_LABELS_UK: readonly string[] = [
  "Нд",
  "Пн",
  "Вт",
  "Ср",
  "Чт",
  "Пт",
  "Сб",
];

/** Order for UI chips: Mon → Sun. */
export const PRICE_WEEKDAY_CHIP_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

export function normalizePriceWeekendDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...DEFAULT_PRICE_WEEKEND_DAYS];
  const days = [
    ...new Set(
      raw
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    ),
  ].sort((a, b) => a - b);
  return days.length > 0 ? days : [...DEFAULT_PRICE_WEEKEND_DAYS];
}

export function isPriceWeekendDay(
  dateObj: Date,
  weekendDays?: number[] | null
): boolean {
  const days = normalizePriceWeekendDays(weekendDays);
  return days.includes(dateObj.getDay());
}

export function formatWeekendDaysHint(weekendDays?: number[] | null): string {
  const days = normalizePriceWeekendDays(weekendDays);
  const ordered = PRICE_WEEKDAY_CHIP_ORDER.filter((d) => days.includes(d));
  if (!ordered.length) return "не обрано";
  return ordered.map((d) => PRICE_WEEKDAY_LABELS_UK[d]).join(", ");
}
