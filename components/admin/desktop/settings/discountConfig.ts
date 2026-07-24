import type { DiscountConfig, DiscountKind } from "../types";
import { isDiscountDraftId } from "@/lib/admin/discountDraft";
import { daysBeforePhrase, daysUntilPhrase, nightsFromPhrase } from "../adminPlural";

export type SpecialGuestCategory = "ubd" | "birthday" | "anniversary" | "other";

export type DiscountPeriodMode = "always" | "range";

export type DiscountListFilter = "all" | DiscountKind;

export type DiscountAccordionForm = {
  name: string;
  kind: DiscountKind | null;
  active: boolean;
  minNights: number;
  daysBefore: number;
  promoCode: string;
  valueType: "percent" | "amount";
  value: number;
  allRooms: boolean;
  selectedRoomIds: string[];
  guestCategory: SpecialGuestCategory;
  periodMode: DiscountPeriodMode;
  periodStart: string;
  periodEnd: string;
};

export const SPECIAL_GUEST_CATEGORIES: { id: SpecialGuestCategory; label: string }[] = [
  { id: "ubd", label: "УБД" },
  { id: "birthday", label: "День народження" },
  { id: "anniversary", label: "Річниця" },
  { id: "other", label: "Інше" },
];

export const DISCOUNT_KIND_BADGE_CLASS: Record<DiscountKind, string> = {
  long_stay: "discount-type-badge discount-type-badge--long-stay",
  early_booking: "discount-type-badge bg-blue-50 text-blue-700 border border-blue-100",
  last_minute: "discount-type-badge bg-orange-50 text-orange-700 border border-orange-100",
  promo_code: "discount-type-badge bg-purple-50 text-purple-700 border border-purple-100",
  ubd: "discount-type-badge bg-slate-100 text-slate-700 border border-slate-200",
};

export const DISCOUNT_KIND_OPTIONS: { kind: DiscountKind; label: string }[] = [
  { kind: "long_stay", label: "Довготривала" },
  { kind: "early_booking", label: "Раннє бронювання" },
  { kind: "last_minute", label: "Гаряча (Last Minute)" },
  { kind: "promo_code", label: "Промокод" },
  { kind: "ubd", label: "Спецтариф (УБД)" },
];

export const DISCOUNT_KIND_META: Record<
  DiscountKind,
  { label: string; badgeClass: string; defaultName: string }
> = {
  long_stay: {
    label: "Довготривале",
    badgeClass: DISCOUNT_KIND_BADGE_CLASS.long_stay,
    defaultName: "Проживання",
  },
  early_booking: {
    label: "Раннє бронювання",
    badgeClass: DISCOUNT_KIND_BADGE_CLASS.early_booking,
    defaultName: "Раннє бронювання",
  },
  last_minute: {
    label: "Гаряча пропозиція",
    badgeClass: DISCOUNT_KIND_BADGE_CLASS.last_minute,
    defaultName: "Гаряча пропозиція",
  },
  promo_code: {
    label: "Промокоди",
    badgeClass: DISCOUNT_KIND_BADGE_CLASS.promo_code,
    defaultName: "Промокод",
  },
  ubd: {
    label: "Спецтарифи",
    badgeClass: DISCOUNT_KIND_BADGE_CLASS.ubd,
    defaultName: "Спецтариф",
  },
};

function inferGuestCategory(d: DiscountConfig): SpecialGuestCategory {
  if (d.guestCategory) return d.guestCategory;
  const cond = String(d.condition || "").toLowerCase();
  if (cond.includes("день народження") || cond.includes("іменин")) return "birthday";
  if (cond.includes("річниц")) return "anniversary";
  if (cond.includes("інше")) return "other";
  return "ubd";
}

function guestCategoryLabel(cat: SpecialGuestCategory, customName?: string): string {
  if (cat === "other" && customName?.trim()) return customName.trim();
  return SPECIAL_GUEST_CATEGORIES.find((c) => c.id === cat)?.label ?? "УБД";
}

function parseCustomOtherName(d: DiscountConfig, guestCategory: SpecialGuestCategory): string {
  if (guestCategory !== "other") return "";
  const rawName = d.name?.trim() || "";
  if (rawName && !rawName.startsWith("Спецтариф")) return rawName;
  const m = String(d.condition || "").match(/Спецтариф:\s*(.+)/i);
  const fromCondition = m?.[1]?.trim() || "";
  if (
    fromCondition &&
    !SPECIAL_GUEST_CATEGORIES.some((c) => c.id !== "other" && c.label === fromCondition)
  ) {
    return fromCondition;
  }
  if (rawName.startsWith("Спецтариф —")) {
    const stripped = rawName.replace(/^Спецтариф —\s*/, "").trim();
    if (stripped && stripped !== "Інше") return stripped;
  }
  return "";
}

export function getDiscountKind(d: DiscountConfig): DiscountKind | null {
  return inferKindFromLegacy(d);
}

function inferKindFromLegacy(d: DiscountConfig): DiscountKind | null {
  if (d.kind) return d.kind;
  const cond = String(d.condition || "").toLowerCase();
  if (cond.includes("убд") || cond.includes("захисник") || cond.includes("спецтариф")) return "ubd";
  if (cond.includes("промокод")) return "promo_code";
  if (cond.includes("last minute") || cond.includes("гаряч")) return "last_minute";
  if (cond.includes("ранн")) return "early_booking";
  if (cond.includes("діб") || cond.includes("ноч")) return "long_stay";
  return null;
}

export function parseDiscountToForm(d: DiscountConfig): DiscountAccordionForm {
  const kind = inferKindFromLegacy(d);
  const roomsIds = d.roomsIds || [];
  const allRooms =
    roomsIds.includes("all") ||
    String(d.rooms || "").includes("Всі котеджі") ||
    (isDiscountDraftId(d.id) && roomsIds.length === 0);
  const valueType = d.valueType === "amount" ? "amount" : "percent";
  let value = d.value ?? (parseInt(String(d.discount).replace(/\D/g, ""), 10) || 15);
  if (valueType === "percent" && !d.value) {
    value = parseInt(String(d.discount).replace(/\D/g, ""), 10) || 15;
  }

  const guestCategory = inferGuestCategory(d);
  const customOtherName = parseCustomOtherName(d, guestCategory);

  return {
    name: guestCategory === "other" ? customOtherName : d.name?.trim() || "",
    kind,
    active: isDiscountDraftId(d.id)
      ? d.active === true
      : d.active !== false && (d.active === true || (d.active == null && Boolean(d.condition))),
    minNights: d.minNights ?? (parseInt(String(d.condition).replace(/\D/g, ""), 10) || 2),
    daysBefore: d.daysBefore ?? 7,
    promoCode: d.promoCode ?? extractPromoCode(d.condition) ?? "",
    valueType,
    value,
    allRooms,
    selectedRoomIds: allRooms ? [] : roomsIds.filter((id) => id !== "all"),
    guestCategory,
    periodMode: d.periodMode === "range" ? "range" : "always",
    periodStart: d.periodStart ?? "",
    periodEnd: d.periodEnd ?? "",
  };
}

function extractPromoCode(condition: string): string {
  const m = String(condition || "").match(/промокод[:\s]+(\S+)/i);
  return m?.[1] ?? "";
}

function extractPromoCodeFromName(name: string): string {
  const m = String(name || "").match(/^Промокод\s+(\S+)/i);
  return m?.[1] ?? "";
}

function buildCondition(form: DiscountAccordionForm): string {
  switch (form.kind) {
    case "long_stay":
      return `Діб в бронюванні: ${form.minNights || 2}`;
    case "early_booking":
      return `Раннє бронювання: ${form.daysBefore || 7} днів`;
    case "last_minute":
      return `Last Minute: ${form.daysBefore || 3} днів`;
    case "promo_code":
      return `Промокод: ${form.promoCode.trim().toUpperCase() || "CODE"}`;
    case "ubd":
      return `Спецтариф: ${guestCategoryLabel(form.guestCategory, form.name)}`;
    default:
      return "";
  }
}

function buildDiscountString(form: DiscountAccordionForm): string {
  if (form.valueType === "amount") {
    return `${form.value || 0} ₴`;
  }
  return `${form.value || 0}%`;
}

function buildDisplayName(form: DiscountAccordionForm): string {
  const trimmed = form.name.trim();
  if (trimmed) return trimmed;
  if (form.kind && DISCOUNT_KIND_META[form.kind]) {
    if (form.kind === "promo_code" && form.promoCode.trim()) {
      return `Промокод ${form.promoCode.trim().toUpperCase()}`;
    }
    if (form.kind === "ubd") {
      if (form.guestCategory === "other" && form.name.trim()) {
        return form.name.trim();
      }
      return `Спецтариф — ${guestCategoryLabel(form.guestCategory, form.name)}`;
    }
    return DISCOUNT_KIND_META[form.kind].defaultName;
  }
  return "Нова знижка";
}

export function buildDiscountConfigFromForm(
  form: DiscountAccordionForm,
  roomsList: { id: number | string; name: string; short?: string }[]
): Omit<DiscountConfig, "id"> {
  let roomsIds: string[] = [];
  let rooms = "Не обрано";

  if (form.allRooms) {
    roomsIds = ["all"];
    rooms = "Всі котеджі";
  } else if (form.selectedRoomIds.length) {
    roomsIds = [...form.selectedRoomIds];
    const names = roomsList
      .filter((r) => roomsIds.includes(String(r.id)))
      .map((r) => r.short?.trim() || r.name);
    rooms = names.length ? names.join(", ") : "Не обрано";
  }

  return {
    name: buildDisplayName(form),
    kind: form.kind ?? undefined,
    active: form.active,
    condition: buildCondition(form),
    discount: buildDiscountString(form),
    rooms,
    roomsIds,
    minNights: form.minNights,
    daysBefore: form.daysBefore,
    promoCode: form.promoCode.trim().toUpperCase(),
    valueType: form.valueType,
    value: form.value,
    guestCategory: form.guestCategory,
    periodMode: form.periodMode,
    periodStart: form.periodMode === "range" ? form.periodStart : undefined,
    periodEnd: form.periodMode === "range" ? form.periodEnd : undefined,
  };
}

export function getDiscountDisplayName(d: DiscountConfig): string {
  if (d.name?.trim()) return d.name.trim();
  const kind = inferKindFromLegacy(d);
  if (kind === "promo_code") {
    const code = d.promoCode || extractPromoCode(d.condition);
    if (code) return `Промокод ${code.toUpperCase()}`;
  }
  if (kind && DISCOUNT_KIND_META[kind]) return DISCOUNT_KIND_META[kind].defaultName;
  if (d.condition?.trim()) return d.condition.trim();
  return "Нова знижка";
}

export function getDiscountKindMeta(d: DiscountConfig) {
  const kind = inferKindFromLegacy(d);
  if (kind) return DISCOUNT_KIND_META[kind];
  return {
    label: "Знижка",
    badgeClass: "discount-type-badge bg-stone-50 text-stone-600 border border-stone-200",
    defaultName: "Знижка",
  };
}

export function getDiscountKindBadgeClass(d: DiscountConfig): string {
  const kind = inferKindFromLegacy(d);
  if (kind) return DISCOUNT_KIND_BADGE_CLASS[kind];
  return "discount-type-badge bg-stone-50 text-stone-600 border border-stone-200";
}

export function getDiscountKindBadgeClassByKind(kind?: DiscountKind | null): string {
  if (kind) return DISCOUNT_KIND_BADGE_CLASS[kind];
  return "discount-type-badge bg-stone-50 text-stone-600 border border-stone-200";
}

export function matchesDiscountSection(d: DiscountConfig, kind: DiscountKind): boolean {
  return inferKindFromLegacy(d) === kind;
}

export function matchesDiscountFilter(d: DiscountConfig, filter: DiscountListFilter): boolean {
  if (filter === "all") return true;
  return matchesDiscountSection(d, filter);
}

export function getDiscountValueLabel(d: DiscountConfig): string {
  if (d.discount?.trim()) return d.discount.trim();
  if (d.valueType === "amount") return `${d.value ?? 0} ₴`;
  return `${d.value ?? 0}%`;
}

export function getDiscountConditionSuffix(d: DiscountConfig): string | null {
  const kind = inferKindFromLegacy(d);
  if (!kind) return null;

  const minNights =
    d.minNights ?? (parseInt(String(d.condition || "").replace(/\D/g, ""), 10) || undefined);
  const daysBefore = d.daysBefore;

  switch (kind) {
    case "long_stay":
      return nightsFromPhrase(minNights ?? 2);
    case "early_booking":
      return daysBeforePhrase(daysBefore ?? 7);
    case "last_minute":
      return daysUntilPhrase(daysBefore ?? 3);
    case "promo_code": {
      const code =
        d.promoCode ||
        extractPromoCode(d.condition || "") ||
        extractPromoCodeFromName(d.name || "");
      return code ? code.toUpperCase() : null;
    }
    case "ubd": {
      const guestCategory = inferGuestCategory(d);
      const customOtherName = parseCustomOtherName(d, guestCategory);
      const label = guestCategoryLabel(guestCategory, customOtherName || d.name);
      return label || null;
    }
    default:
      return null;
  }
}

/** Підпис тумблера в деталях броні (ХАТА, УБД, День народження…). */
export function getSpecialTariffToggleLabel(d: DiscountConfig): string {
  const kind = inferKindFromLegacy(d);
  if (kind !== "ubd") return getDiscountListRowTitleName(d);

  const guestCategory = inferGuestCategory(d);
  if (guestCategory === "other") {
    const custom = parseCustomOtherName(d, guestCategory);
    if (custom) return custom;
    const suffix = getDiscountConditionSuffix(d);
    if (suffix) return suffix;
  }

  return guestCategoryLabel(guestCategory, d.name);
}

/** Коротка назва в рядку списку (без «Довготривале» для проживання). */
export function getDiscountListRowTitleName(d: DiscountConfig): string {
  const name = getDiscountDisplayName(d);
  const kind = inferKindFromLegacy(d);

  if (kind === "long_stay") {
    if (
      !name ||
      name === "Довготривале проживання" ||
      name === "Проживання" ||
      name === DISCOUNT_KIND_META.long_stay.defaultName
    ) {
      return "Проживання";
    }
    if (name.startsWith("Довготривале ")) {
      return name.replace(/^Довготривале\s+/, "").trim() || "Проживання";
    }
  }

  if (kind === "promo_code") {
    return "Промокод";
  }

  if (kind === "ubd") {
    return "Спецтариф";
  }

  return name;
}

/** Чи знижка вважається увімкненою (з урахуванням legacy-записів). */
export function resolveDiscountActive(d: DiscountConfig, isDraft = false): boolean {
  if (isDraft) return false;
  if (d.active === false) return false;
  if (d.active === true) return true;
  return Boolean(d.condition?.trim());
}
