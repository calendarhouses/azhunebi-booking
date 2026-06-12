import { buildDefaultAmenitiesState } from "@/constants/amenitiesDict";
import type { LucideIcon } from "lucide-react";
import { Banknote, Image as ImageIcon, Info, Sparkles } from "lucide-react";
import type { RoomConfig } from "@/components/admin/desktop/types";

export type RoomSettingsStepId = "info" | "gallery" | "amenities" | "prices";

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
    description: "Назва, місткість та головні фішки для сайту",
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
    id: "prices",
    title: "Базові ціни",
    description: "Тариф на будні та вихідні",
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
    amenities: buildDefaultAmenitiesState(),
    siteHighlights: [],
  };
  const merged = { ...base, ...partial, id, name: partial?.name?.trim() || name };
  merged.short = merged.name;
  merged.maxCapacity = merged.maxCapacity ?? Math.max(merged.capacity, merged.capacity + 2);
  return merged;
}

export function getActiveAmenityIds(room: RoomConfig): string[] {
  const ids: string[] = [];
  if (!room.amenities) return ids;
  for (const items of Object.values(room.amenities)) {
    for (const item of items || []) {
      if (item.isActive) ids.push(item.id);
    }
  }
  return ids;
}
