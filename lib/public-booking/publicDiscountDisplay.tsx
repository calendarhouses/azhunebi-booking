import type { DiscountConfig, DiscountKind } from "@/components/admin/desktop/types";
import {
  DISCOUNT_KIND_META,
  getDiscountConditionSuffix,
  getDiscountKind,
  getSpecialTariffToggleLabel,
} from "@/components/admin/desktop/settings/discountConfig";
import { nightsFromPhrase } from "@/components/admin/desktop/adminPlural";
import { CalendarClock, Flame, Moon, Sparkles } from "lucide-react";
import type { PublicDiscount } from "./types";
import { getRoomDiscounts } from "./desktopRoomContent";

const ICON_SIZE = 24;
const ICON_STROKE = 1.5;

function capitalizePhrase(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function publicNightsFromPhrase(count: number): string {
  return capitalizePhrase(nightsFromPhrase(count));
}

function asDiscountConfig(d: PublicDiscount): DiscountConfig {
  return d as DiscountConfig;
}

export function getPublicRoomDiscounts(
  roomId: number,
  discounts: PublicDiscount[]
): PublicDiscount[] {
  return getRoomDiscounts(roomId, discounts).filter((d) => {
    const kind = getDiscountKind(asDiscountConfig(d));
    return kind !== "promo_code" && kind !== "ubd";
  });
}

export function formatPublicDiscountLabel(discount: PublicDiscount): string {
  const d = asDiscountConfig(discount);
  const kind = getDiscountKind(d);

  switch (kind) {
    case "long_stay": {
      const nights =
        d.minNights ?? (parseInt(String(d.condition || "").replace(/\D/g, ""), 10) || 0);
      return nights ? publicNightsFromPhrase(nights) : "Довге проживання";
    }
    case "early_booking":
      return "Раннє бронювання";
    case "last_minute":
      return "Гаряча пропозиція";
    case "ubd":
      return getSpecialTariffToggleLabel(d);
    default: {
      let text = (d.condition || "").trim();
      text = text.replace(/^Спецтариф:\s*/i, "");
      text = text.replace(/^Промокод:\s*\S+/i, "").trim();
      text = text.replace(/^Раннє бронювання:\s*/i, "Раннє бронювання");
      text = text.replace(/^Діб в бронюванні:\s*(\d+)/i, (_, n) => publicNightsFromPhrase(Number(n)));
      const suffix = getDiscountConditionSuffix(d);
      if (!text && suffix) return suffix ? capitalizePhrase(suffix) : suffix;
      return text ? capitalizePhrase(text) : "Знижка";
    }
  }
}

export function PublicDiscountIcon({ discount }: { discount: PublicDiscount }) {
  const kind = getDiscountKind(asDiscountConfig(discount));
  const className = "public-discount-icon";

  switch (kind) {
    case "early_booking":
      return (
        <CalendarClock
          className={className}
          size={ICON_SIZE}
          strokeWidth={ICON_STROKE}
          aria-hidden
        />
      );
    case "last_minute":
      return <Flame className={className} size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />;
    case "ubd":
      return (
        <Sparkles className={className} size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />
      );
    case "long_stay":
    default:
      return <Moon className={className} size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />;
  }
}

export function getPublicDiscountKind(discount: PublicDiscount): DiscountKind | null {
  return getDiscountKind(asDiscountConfig(discount));
}

export type PublicDiscountCategoryBlock = {
  id: DiscountKind;
  title: string;
  discounts: PublicDiscount[];
};

const DISCOUNT_CATEGORY_ORDER: DiscountKind[] = [
  "long_stay",
  "early_booking",
  "last_minute",
  "ubd",
];

export function buildPublicDiscountsByCategory(
  roomId: number,
  discounts: PublicDiscount[]
): PublicDiscountCategoryBlock[] {
  const list = getPublicRoomDiscounts(roomId, discounts);
  const map = new Map<DiscountKind, PublicDiscount[]>();

  for (const discount of list) {
    const kind = getDiscountKind(asDiscountConfig(discount));
    if (!kind || kind === "promo_code") continue;
    const bucket = map.get(kind) || [];
    bucket.push(discount);
    map.set(kind, bucket);
  }

  return DISCOUNT_CATEGORY_ORDER.filter((kind) => map.has(kind)).map((kind) => ({
    id: kind,
    title: DISCOUNT_KIND_META[kind].label,
    discounts: map.get(kind) || [],
  }));
}

export function formatPublicDiscountValue(discount: PublicDiscount): string {
  const value = String(discount.discount || "").trim();
  if (!value) return "";
  return value.startsWith("-") ? value : `-${value}`;
}

export function PublicDiscountCard({ discount }: { discount: PublicDiscount }) {
  return (
    <div className="rule-card rule-card--discount">
      <PublicDiscountIcon discount={discount} />
      <div className="rule-card__text">{formatPublicDiscountLabel(discount)}</div>
      <span className="rule-card__badge">{formatPublicDiscountValue(discount)}</span>
    </div>
  );
}
