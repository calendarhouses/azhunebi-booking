import type { DiscountConfig, DiscountKind } from "@/components/admin/desktop/types";
import {
  getDiscountConditionSuffix,
  getDiscountDisplayName,
  getDiscountKind,
  getDiscountListRowTitleName,
  resolveDiscountActive,
} from "@/components/admin/desktop/settings/discountConfig";
import { isDiscountDraftId } from "@/lib/admin/discountDraft";

export type AppliedDiscountType = "fixed" | "percent";

export type AppliedDiscount = {
  id: string;
  name: string;
  type: AppliedDiscountType;
  /** Для percent — число відсотків (15 = 15%). Для fixed — сума в ₴. */
  value: number;
  kind?: DiscountKind;
  /** Коротка назва як у списку знижок (Проживання, Раннє бронювання…). */
  titleName?: string;
  /** Умова: «від 3 ночей», «за 7 днів», «до 20 днів». */
  conditionSuffix?: string | null;
};

export type DiscountLineResult = {
  discount: AppliedDiscount;
  amount: number;
};

export type CalculateTotalResult = {
  total: number;
  lines: DiscountLineResult[];
  discountSum: number;
};

export type BookingDiscountContext = {
  checkIn: string;
  checkOut: string;
  nights: number;
  roomId: string;
  /** id увімкнених спецтарифів з форми броні */
  enabledSpecialTariffIds: string[];
  promoCode?: string;
  today?: Date;
};

export function parseDiscountNumericValue(d: DiscountConfig): number {
  if (typeof d.value === "number" && !Number.isNaN(d.value)) return d.value;
  const parsed = parseInt(String(d.discount || "").replace(/\D/g, ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function discountConfigToApplied(d: DiscountConfig): AppliedDiscount {
  const type: AppliedDiscountType = d.valueType === "amount" ? "fixed" : "percent";
  return {
    id: String(d.id),
    name: getDiscountDisplayName(d),
    type,
    value: parseDiscountNumericValue(d),
    kind: getDiscountKind(d) ?? undefined,
    titleName: getDiscountListRowTitleName(d),
    conditionSuffix: getDiscountConditionSuffix(d),
  };
}

function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function daysUntilCheckIn(checkInStr: string, today: Date): number {
  const checkIn = startOfDay(parseIsoDate(checkInStr));
  const now = startOfDay(today);
  return Math.round((checkIn.getTime() - now.getTime()) / 86_400_000);
}

function discountAppliesToRoom(d: DiscountConfig, roomId: string): boolean {
  return (
    (d.roomsIds && (d.roomsIds.includes("all") || d.roomsIds.includes(roomId))) ||
    (!d.roomsIds && String(d.rooms).includes("Всі"))
  );
}

function isWithinPeriod(d: DiscountConfig, checkIn: Date): boolean {
  if (d.periodMode !== "range") return true;
  if (!d.periodStart || !d.periodEnd) return true;
  const start = startOfDay(parseIsoDate(d.periodStart));
  const end = startOfDay(parseIsoDate(d.periodEnd));
  const arrival = startOfDay(checkIn);
  return arrival >= start && arrival <= end;
}

function extractPromoCode(d: DiscountConfig): string {
  const fromField = d.promoCode?.trim();
  if (fromField) return fromField.toUpperCase();
  const m = String(d.condition || "").match(/промокод[:\s]+(\S+)/i);
  return m?.[1]?.toUpperCase() ?? "";
}

function discountEffectiveAmount(discount: AppliedDiscount, amountToDiscount: number): number {
  if (discount.type === "percent") {
    return Math.round(amountToDiscount * (Math.max(0, discount.value) / 100));
  }
  return Math.round(Math.max(0, discount.value));
}

function discountMatchesBooking(
  d: DiscountConfig,
  ctx: BookingDiscountContext,
  checkInDate: Date
): boolean {
  const kind = getDiscountKind(d);
  if (!kind) return false;

  switch (kind) {
    case "long_stay": {
      const minNights =
        d.minNights ?? (parseInt(String(d.condition || "").replace(/\D/g, ""), 10) || 0);
      return ctx.nights >= minNights;
    }
    case "early_booking": {
      const daysBefore = d.daysBefore ?? 7;
      return daysUntilCheckIn(ctx.checkIn, ctx.today ?? new Date()) >= daysBefore;
    }
    case "last_minute": {
      const maxDays = d.daysBefore ?? 3;
      const daysLeft = daysUntilCheckIn(ctx.checkIn, ctx.today ?? new Date());
      return daysLeft >= 0 && daysLeft <= maxDays;
    }
    case "promo_code": {
      if (!ctx.promoCode?.trim()) return false;
      return extractPromoCode(d) === ctx.promoCode.trim().toUpperCase();
    }
    case "ubd":
      return ctx.enabledSpecialTariffIds.includes(String(d.id));
    default:
      return false;
  }
}

export function listActivePromoCodeDiscounts(
  discountsList: DiscountConfig[] = [],
  roomId?: string
): DiscountConfig[] {
  return discountsList.filter((d) => {
    if (isDiscountDraftId(d.id)) return false;
    if (!resolveDiscountActive(d)) return false;
    if (getDiscountKind(d) !== "promo_code") return false;
    if (!extractPromoCode(d)) return false;
    if (roomId && !discountAppliesToRoom(d, roomId)) return false;
    return true;
  });
}

export function hasActivePromoCodeDiscounts(
  discountsList: DiscountConfig[] = [],
  roomId?: string
): boolean {
  return listActivePromoCodeDiscounts(discountsList, roomId).length > 0;
}

export function extractPromoCodeFromConfig(d: DiscountConfig): string {
  return extractPromoCode(d);
}

export function buildPromoCodeCommentToken(code: string): string | null {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  return `🎟️ Промокод: ${trimmed}`;
}

const PROMO_COMMENT_TOKEN = /🎟️\s*Промокод:\s*(\S+)/i;

export function parsePromoCodeFromComment(raw: string): string {
  const match = raw.match(PROMO_COMMENT_TOKEN);
  return match?.[1]?.toUpperCase() ?? "";
}

export function stripPromoCodeFromComment(raw: string): string {
  return raw
    .replace(PROMO_COMMENT_TOKEN, "")
    .replace(/\|\s*\|\s*/g, " | ")
    .replace(/^\|\s*/, "")
    .replace(/\|\s*$/, "")
    .trim();
}

export function promoCodeAppliesToBooking(
  code: string,
  discountsList: DiscountConfig[] = [],
  ctx: BookingDiscountContext,
  amountToDiscount = 0
): boolean {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return false;
  return resolveApplicableBookingDiscounts(
    discountsList,
    { ...ctx, promoCode: normalized },
    amountToDiscount
  ).some((discount) => discount.kind === "promo_code");
}

/** Автоматично підбирає знижки з каталогу за умовами бронювання (лише увімкнені). */
export function resolveApplicableBookingDiscounts(
  discountsList: DiscountConfig[] = [],
  ctx: BookingDiscountContext,
  amountToDiscount = 0
): AppliedDiscount[] {
  const checkInDate = parseIsoDate(ctx.checkIn);
  const matched: AppliedDiscount[] = [];
  const longStayCandidates: AppliedDiscount[] = [];

  for (const d of discountsList) {
    if (isDiscountDraftId(d.id)) continue;
    if (!resolveDiscountActive(d)) continue;
    if (!discountAppliesToRoom(d, ctx.roomId)) continue;
    if (!isWithinPeriod(d, checkInDate)) continue;
    if (!discountMatchesBooking(d, ctx, checkInDate)) continue;

    const applied = discountConfigToApplied(d);
    if (applied.value <= 0) continue;

    if (applied.kind === "long_stay" || (!applied.kind && getDiscountKind(d) === null)) {
      longStayCandidates.push(applied);
      continue;
    }

    matched.push(applied);
  }

  if (longStayCandidates.length > 0) {
    const best = longStayCandidates.reduce((winner, candidate) =>
      discountEffectiveAmount(candidate, amountToDiscount) >
      discountEffectiveAmount(winner, amountToDiscount)
        ? candidate
        : winner
    );
    matched.unshift(best);
  }

  return matched;
}

export function getActiveCatalogDiscounts(discountsList: DiscountConfig[] = []): AppliedDiscount[] {
  return discountsList
    .filter((d) => !isDiscountDraftId(d.id) && resolveDiscountActive(d))
    .map(discountConfigToApplied);
}

export type BookingCatalogDiscountEntry = {
  discount: AppliedDiscount;
  enabledOnSite: boolean;
};

export function getBookingCatalogDiscountEntries(
  discountsList: DiscountConfig[] = []
): BookingCatalogDiscountEntry[] {
  return discountsList
    .filter((d) => !isDiscountDraftId(d.id))
    .map((d) => ({
      discount: discountConfigToApplied(d),
      enabledOnSite: resolveDiscountActive(d),
    }))
    .filter((entry) => entry.discount.value > 0);
}

export function isDiscountEnabledInCatalog(d: DiscountConfig): boolean {
  return !isDiscountDraftId(d.id) && resolveDiscountActive(d);
}

export function formatDiscountLineForGuest(d: AppliedDiscount): string {
  const title = (d.titleName ?? d.name).trim();
  if (d.conditionSuffix) return `${title} · ${d.conditionSuffix}`;
  return title;
}

export function formatAppliedDiscountLabel(d: AppliedDiscount): string {
  if (d.type === "percent") return `${d.value}%`;
  return `${d.value.toLocaleString("uk-UA")} ₴`;
}

export function formatDiscountDeduction(amount: number): string {
  return `- ${amount.toLocaleString("uk-UA")} ₴`;
}

function allocateDiscountLines(
  taxableAmount: number,
  entries: { discount: AppliedDiscount; requested: number }[]
): CalculateTotalResult {
  const taxable = Math.max(0, Math.round(taxableAmount));
  let remaining = taxable;
  const lines: DiscountLineResult[] = [];

  for (const { discount, requested } of entries) {
    if (remaining <= 0) {
      lines.push({ discount, amount: 0 });
      continue;
    }
    const request = Math.max(0, Math.round(requested));
    const cap =
      discount.type === "percent"
        ? Math.round(remaining * (Math.max(0, discount.value) / 100))
        : Math.min(remaining, request);
    const amount = Math.min(request, cap, remaining);
    lines.push({ discount, amount });
    remaining -= amount;
  }

  const discountSum = taxable - remaining;
  return { total: remaining, lines, discountSum };
}

/** Ручні суми в розшифровці — довільні грн, без обмеження «% від залишку». */
function allocateManualDiscountLines(
  taxableAmount: number,
  entries: { discount: AppliedDiscount; requested: number }[]
): CalculateTotalResult {
  const taxable = Math.max(0, Math.round(taxableAmount));
  let remaining = taxable;
  const lines: DiscountLineResult[] = [];

  for (const { discount, requested } of entries) {
    const request = Math.max(0, Math.round(requested));
    const amount = Math.min(request, remaining);
    lines.push({ discount, amount });
    remaining -= amount;
  }

  const discountSum = taxable - remaining;
  return { total: remaining, lines, discountSum };
}

/**
 * Знижки застосовуються по черзі до залишку бази (сума в рядках = реальне віднімання).
 */
export function calculateTotal(
  taxableAmount: number,
  appliedDiscounts: AppliedDiscount[]
): CalculateTotalResult {
  const taxable = Math.max(0, Math.round(taxableAmount));
  return allocateDiscountLines(
    taxable,
    appliedDiscounts.map((discount) => ({
      discount,
      requested:
        discount.type === "percent"
          ? Math.round(taxable * (Math.max(0, discount.value) / 100))
          : Math.round(Math.max(0, discount.value)),
    }))
  );
}

export function clampDiscountAmount(amount: number, maxAmount: number): number {
  const max = Math.max(0, Math.round(maxAmount));
  if (!Number.isFinite(amount)) return 0;
  return Math.min(Math.max(0, Math.round(amount)), max);
}

/**
 * Максимум для ручного вводу: база мінус лише інші вже відредаговані рядки.
 * Автознижки в інших рядках не зменшують ліміт — їх перерахує allocateManualDiscountLines.
 */
export function computeDiscountLineMax(
  lineId: string,
  taxableAmount: number,
  lines: DiscountLineResult[],
  overrides: Record<string, number>,
  editedIds: Set<string>
): number {
  const taxable = Math.max(0, Math.round(taxableAmount));
  let used = 0;
  for (const line of lines) {
    if (line.discount.id === lineId) continue;
    if (!editedIds.has(line.discount.id)) continue;
    if (overrides[line.discount.id] !== undefined) {
      used += overrides[line.discount.id]!;
    }
  }
  return Math.max(0, taxable - used);
}

/** Застосовує ручні суми знижок (редагування в розшифровці). */
export function applyManualDiscountOverrides(
  result: CalculateTotalResult,
  overrides: Record<string, number>
): CalculateTotalResult {
  if (!Object.keys(overrides).length) return result;
  const taxable = result.total + result.discountSum;
  return allocateManualDiscountLines(
    taxable,
    result.lines.map((line) => ({
      discount: line.discount,
      requested:
        line.discount.id in overrides
          ? overrides[line.discount.id]!
          : line.amount,
    }))
  );
}
