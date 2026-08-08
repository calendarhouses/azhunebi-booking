import { buildDefaultAmenitiesState } from "@/constants/amenitiesDict";
import {
  buildDefaultHouseRulesState,
  HOUSE_RULES_CATEGORY_ID,
  LEGACY_RULE_ID_MAP,
} from "@/constants/rulesDict";
import type { LucideIcon } from "lucide-react";
import { Banknote, Image as ImageIcon, Info, ScrollText, Sparkles } from "lucide-react";
import type { RoomConfig } from "@/components/admin/desktop/types";

export type RoomSettingsStepId = "info" | "gallery" | "amenities" | "rules" | "prices";

export type RoomSettingsStep = {
  id: RoomSettingsStepId;
  title: string;
  description: string;
  Icon: LucideIcon;
};

export const ROOM_SETTINGS_STEPS: RoomSettingsStep[] = [
  {
    id: "info",
    title: "Основна інформація",
    description: "Назви для сайту і шахматки, місткість, фішки",
    Icon: Info,
  },
  {
    id: "gallery",
    title: "Галерея",
    description: "Фотографії житла для публічної сторінки",
    Icon: ImageIcon,
  },
  {
    id: "amenities",
    title: "Зручності",
    description: "Комфорт і обладнання для гостей",
    Icon: Sparkles,
  },
  {
    id: "rules",
    title: "Правила",
    description: "Умови проживання для гостей",
    Icon: ScrollText,
  },
  {
    id: "prices",
    title: "Базові ціни",
    description: "Тариф 2+ / 1 ніч і дні дорогого тарифу",
    Icon: Banknote,
  },
];

export function createDefaultRoomConfig(id: number, partial?: Partial<RoomConfig>): RoomConfig {
  const capacity = Math.max(1, partial?.capacity ?? 2);
  const name = partial?.name?.trim() ?? "";
  const base: RoomConfig = {
    id,
    name,
    short: name,
    desc: "",
    capacity,
    maxCapacity: Math.max(capacity, capacity + 2),
    extraGuestPrice: partial?.extraGuestPrice ?? 2500,
    priceWeekday: partial?.priceWeekday ?? 0,
    priceWeekend: partial?.priceWeekend ?? 0,
    active: true,
    photos: [],
    detailedDescription: "",
    rules: {
      checkInTime: "15:00",
      checkOutTime: "11:00",
      pets: { isPetsFriendly: false, description: "За узгодженням" },
      selfCheckIn: { enabled: false, description: "" },
    },
    amenities: {
      ...buildDefaultAmenitiesState(),
      ...buildDefaultHouseRulesState(),
    },
    siteHighlights: [],
  };
  const merged = { ...base, ...partial, id, name: partial?.name?.trim() || name };
  if (!merged.short?.trim()) merged.short = merged.name;
  merged.maxCapacity = merged.maxCapacity ?? Math.max(merged.capacity, merged.capacity + 2);
  return merged;
}

export function getActiveAmenityIds(room: RoomConfig): string[] {
  const ids: string[] = [];
  if (!room.amenities) return ids;
  for (const [categoryId, items] of Object.entries(room.amenities)) {
    if (categoryId === HOUSE_RULES_CATEGORY_ID || categoryId === "rules") continue;
    for (const item of items || []) {
      if (item.isActive) ids.push(item.id);
    }
  }
  return ids;
}

export function getActiveRuleIds(room: RoomConfig): string[] {
  const ids: string[] = [];
  const houseRules = room.amenities?.[HOUSE_RULES_CATEGORY_ID] || [];
  for (const item of houseRules) {
    if (item.isActive) ids.push(item.id);
  }

  const legacyRules = room.amenities?.rules || [];
  for (const item of legacyRules) {
    if (!item?.isActive) continue;
    const mapped = LEGACY_RULE_ID_MAP[item.id] || item.id;
    if (!ids.includes(mapped)) ids.push(mapped);
  }

  return ids;
}
