import type { NightlyPriceLine } from "@/components/admin/desktop/BookingNightlyBreakdown";

export type NightlyPriceOverrides = Record<string, number>;

export function applyNightlyPriceOverrides(
  lines: NightlyPriceLine[],
  overrides: NightlyPriceOverrides
): NightlyPriceLine[] {
  if (!lines.length || !Object.keys(overrides).length) return lines;
  return lines.map((line) => {
    const override = overrides[line.dateKey];
    if (override === undefined) return line;
    return { ...line, price: Math.max(0, Math.round(override)) };
  });
}

export function sumNightlyPrices(lines: NightlyPriceLine[]): number {
  return lines.reduce((sum, line) => sum + Math.max(0, Math.round(line.price)), 0);
}

export function hasNightlyPriceOverrides(overrides: NightlyPriceOverrides): boolean {
  return Object.keys(overrides).length > 0;
}
