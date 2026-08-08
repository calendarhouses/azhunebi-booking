import { dobaWord } from "@/components/admin/desktop/adminPlural";
import { isPriceWeekendDay } from "@/lib/pricing/priceWeekendDays";
import type { PublicBranding } from "./types";

export type PrepaymentMode = "percent" | "nights" | "fixed";

export type PrepaymentPolicy = {
  mode: PrepaymentMode;
  value: number;
};

const DEFAULT_POLICY: PrepaymentPolicy = { mode: "percent", value: 50 };

function hasExplicitPrepaymentValue(branding?: PublicBranding | null): boolean {
  const raw = branding?.prepayment_value;
  return raw !== undefined && raw !== null && String(raw).trim() !== "";
}

export function readPrepaymentPolicy(branding?: PublicBranding | null): PrepaymentPolicy {
  const mode = (branding?.prepayment_mode as PrepaymentMode) || "percent";

  if (!branding?.prepayment_mode && !hasExplicitPrepaymentValue(branding)) {
    return DEFAULT_POLICY;
  }

  const value = hasExplicitPrepaymentValue(branding)
    ? Math.max(0, Math.round(Number(branding?.prepayment_value) || 0))
    : DEFAULT_POLICY.value;

  if (mode === "nights") {
    return { mode: "nights", value: Math.min(30, value) };
  }
  if (mode === "fixed") {
    return { mode: "fixed", value };
  }
  return { mode: "percent", value: Math.min(100, value) };
}

export function formatPrepaymentLabel(policy: PrepaymentPolicy): string {
  if (policy.value <= 0) return "0 грн";
  if (policy.mode === "percent") return `${policy.value}%`;
  if (policy.mode === "fixed") return `${policy.value.toLocaleString("uk-UA")} грн`;
  return `${policy.value} ${dobaWord(policy.value)}`;
}

export function formatPrepaymentGuestLabel(policy: PrepaymentPolicy): string {
  if (policy.value <= 0) return "Без передплати";
  return `Передплата ${formatPrepaymentLabel(policy)}`;
}

/** Сума перших N ночей з тарифу (не середнє по всій броні). */
export function sumFirstNightsBase(
  nightlyBasePrices: number[] | undefined,
  nightCount: number
): number {
  if (!nightlyBasePrices?.length || nightCount <= 0) return 0;
  const n = Math.min(Math.round(nightCount), nightlyBasePrices.length);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += Math.max(0, Math.round(Number(nightlyBasePrices[i]) || 0));
  }
  return sum;
}

/** Ціни ночей у порядку заїзду з weekday/weekend + 1-night + customPrices. */
export function buildStayNightlyBasePrices(opts: {
  checkIn: Date;
  nights: number;
  priceWeekday: number;
  priceWeekend: number;
  priceOneNightWeekday?: number | null;
  priceOneNightWeekend?: number | null;
  weekendDays?: number[] | null;
  roomId?: string | number | null;
  customPrices?: Record<string, Record<string, number>> | null;
}): number[] {
  const nights = Math.max(0, Math.round(opts.nights));
  if (nights <= 0 || isNaN(opts.checkIn.getTime())) return [];
  const rid = opts.roomId != null ? String(opts.roomId) : "";
  const roomPrices =
    (rid && opts.customPrices?.[rid]) ||
    (rid && opts.customPrices?.[String(Number(rid))]) ||
    undefined;
  const out: number[] = [];
  for (let i = 0; i < nights; i++) {
    const d = new Date(opts.checkIn);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    const isWeekend = isPriceWeekendDay(d, opts.weekendDays);
    let dayRate = isWeekend ? opts.priceWeekend : opts.priceWeekday;
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (roomPrices?.[ds] != null) {
      const custom = Number(roomPrices[ds]);
      if (Number.isFinite(custom) && custom > 0) dayRate = custom;
    }
    if (nights === 1) {
      const one = Number(isWeekend ? opts.priceOneNightWeekend : opts.priceOneNightWeekday);
      // Same as getDayPrice: 1-night floor vs day/custom rate (special highs still win).
      if (Number.isFinite(one) && one > 0) dayRate = Math.max(one, dayRate);
    }
    out.push(Math.max(0, Math.round(Number(dayRate) || 0)));
  }
  return out;
}

export function calculatePrepaymentAmount(
  policy: PrepaymentPolicy,
  opts: {
    totalPrice: number;
    basePriceTotal: number;
    nights: number;
    /** Ціни ночей у порядку заїзду (з календаря тарифів). Для mode=nights — перші N ночей. */
    nightlyBasePrices?: number[];
  }
): number {
  if (policy.value <= 0) return 0;

  const total = Math.max(0, Math.round(opts.totalPrice));
  if (total <= 0) return 0;

  if (policy.mode === "fixed") {
    return Math.min(total, Math.round(policy.value));
  }

  if (policy.mode === "nights") {
    const stayNights = Math.max(1, opts.nights);
    const nightsWanted = Math.min(Math.round(policy.value), stayNights);
    const fromNights = sumFirstNightsBase(opts.nightlyBasePrices, nightsWanted);
    if (fromNights > 0) {
      return Math.min(total, fromNights);
    }
    // Fallback лише коли немає розбивки по ночах.
    const nightRate = Math.round(Math.max(0, opts.basePriceTotal) / stayNights);
    return Math.min(total, nightRate * nightsWanted);
  }

  const pct = Math.min(100, Math.round(policy.value));
  return Math.round((total * pct) / 100);
}
