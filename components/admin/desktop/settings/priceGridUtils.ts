/** Формат «6 000 ₴» для клітинок шахматки цін */
export function formatPriceAmount(amount: number): string {
  return Math.round(Number(amount) || 0)
    .toLocaleString("uk-UA")
    .replace(/\u00a0/g, " ")
    .replace(/,/g, " ");
}

export function parsePriceInput(raw: string): number {
  const n = parseInt(String(raw || "").replace(/\s/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** «Травень 2026» без «р.» */
export function formatMonthYearLabel(d: Date): string {
  const raw = d.toLocaleString("uk-UA", { month: "long", year: "numeric" });
  const cleaned = raw.replace(/\s*р\.?\s*$/i, "").trim();
  if (!cleaned) return raw;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Висота рядка дат — під два рядки тексту без «повітря» знизу */
export const PRICE_GRID_MONTH_HEIGHT = 30;
export const PRICE_GRID_DATES_HEIGHT = 28;
export const PRICE_GRID_HEADER_HEIGHT = PRICE_GRID_MONTH_HEIGHT + PRICE_GRID_DATES_HEIGHT;

const PRICE_CELL_MIN = 72;
const PRICE_ROW_HEIGHT = 58;

/** Ширина клітинки під текст «5 555 ₴» */
export function measurePriceCellWidth(amount: number): number {
  const label = `${formatPriceAmount(amount)} ₴`;
  return Math.max(PRICE_CELL_MIN, Math.ceil(label.length * 6.8) + 16);
}

/** Ширина клітинки під редагування (лише цифри + рамка редактора) */
export function measurePriceEditWidth(draft: string): number {
  const len = Math.max(String(draft || "").replace(/\s/g, "").length, 1);
  // margin 8 + border 2 + padding 16 + ~10px/цифра при 14px/600
  return Math.max(PRICE_CELL_MIN, Math.ceil(len * 10) + 36);
}

export { PRICE_CELL_MIN, PRICE_ROW_HEIGHT };
