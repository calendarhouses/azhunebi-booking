import type { DiscountConfig, DiscountKind } from "@/components/admin/desktop/types";

let nextDraftDiscountId = -1;

export function allocateDraftDiscountId(): number {
  nextDraftDiscountId -= 1;
  return nextDraftDiscountId;
}

export function isDiscountDraftId(id: number): boolean {
  return id < 0;
}

export function dedupeDiscountsList(list: DiscountConfig[]): DiscountConfig[] {
  const seen = new Set<number>();
  const result: DiscountConfig[] = [];
  for (const item of list) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function kindDefaults(kind?: DiscountKind): Pick<
  DiscountConfig,
  "minNights" | "daysBefore" | "promoCode" | "value" | "valueType"
> {
  switch (kind) {
    case "long_stay":
      return { minNights: 3, daysBefore: 7, promoCode: "", value: 15, valueType: "percent" };
    case "early_booking":
      return { minNights: 2, daysBefore: 30, promoCode: "", value: 10, valueType: "percent" };
    case "last_minute":
      return { minNights: 2, daysBefore: 3, promoCode: "", value: 20, valueType: "percent" };
    case "promo_code":
      return { minNights: 2, daysBefore: 7, promoCode: "", value: 15, valueType: "percent" };
    case "ubd":
      return { minNights: 2, daysBefore: 7, promoCode: "", value: 15, valueType: "percent" };
    default:
      return { minNights: 2, daysBefore: 7, promoCode: "", value: 15, valueType: "percent" };
  }
}

export function createDraftDiscount(kind?: DiscountKind): DiscountConfig {
  return {
    id: allocateDraftDiscountId(),
    name: "",
    kind,
    active: false,
    condition: "",
    discount: "",
    rooms: "",
    roomsIds: [],
    ...kindDefaults(kind),
  };
}
