import type { ReactNode } from "react";
import { AMENITIES_CATEGORIES } from "@/constants/amenitiesDict";
import { HOUSE_RULES_CATEGORY_ID } from "@/constants/rulesDict";
import type { PublicDiscount, PublicRoom } from "./types";
import { PublicAmenityIcon } from "./publicAmenityIcon";
import { PublicHighlightIcon } from "./publicHighlightIcon";

export type AmenityItem = { icon: ReactNode; label: string };
export type AmenityCategoryBlock = {
  id: string;
  title: string;
  items: AmenityItem[];
};

export function getRoomSiteFeatures(room: PublicRoom): AmenityItem[] {
  const fromHighlights = (room.siteHighlights || [])
    .filter((row) => row.text?.trim())
    .map((row) => ({
      icon: <PublicHighlightIcon iconId={row.iconId} />,
      label: row.text.trim(),
    }));

  if (fromHighlights.length) return fromHighlights;

  const { featured } = buildPublicAmenities(room);
  return featured;
}

export function getRoomDescription(room: PublicRoom): string {
  if (room.detailedDescription?.trim()) {
    return room.detailedDescription.trim();
  }
  const desc = (room.desc || "").trim();
  return desc;
}

export function getRoomAmenities(room: PublicRoom): AmenityItem[] {
  const { all } = buildPublicAmenities(room);
  return all;
}

export function buildPublicAmenities(
  room: PublicRoom
): { featured: AmenityItem[]; byCategory: AmenityCategoryBlock[]; all: AmenityItem[] } {
  const src = room.amenities;
  if (!src) {
    return { featured: [], byCategory: [], all: [] };
  }

  const featured: AmenityItem[] = [];
  const byCategory: AmenityCategoryBlock[] = [];
  const all: AmenityItem[] = [];

  for (const cat of AMENITIES_CATEGORIES) {
    if (cat.id === "rules") continue;

    const items = src[cat.id] || [];
    const activeItems = items.filter((i) => i?.isActive);
    if (!activeItems.length) continue;

    const catBlock: AmenityCategoryBlock = {
      id: cat.id,
      title: cat.title,
      items: [],
    };

    for (const item of activeItems) {
      const dictItem = cat.items.find((d) => d.id === item.id);
      const label = (item.customText && item.customText.trim()) || dictItem?.label || item.id;
      const amenity: AmenityItem = {
        icon: <PublicAmenityIcon id={item.id} />,
        label,
      };
      all.push(amenity);
      catBlock.items.push(amenity);
      if (item.isFeatured) {
        featured.push(amenity);
      }
    }

    if (catBlock.items.length) {
      byCategory.push(catBlock);
    }
  }

  return { featured, byCategory, all };
}

export function getRoomDiscounts(
  roomId: number,
  discounts: PublicDiscount[]
): PublicDiscount[] {
  return discounts.filter((d) => {
    if (d.active === false) return false;
    if (d.roomsIds?.length) {
      return d.roomsIds.includes("all") || d.roomsIds.includes(String(roomId));
    }
    const rooms = (d.rooms || "").toLowerCase();
    return rooms.includes("всі") || rooms.includes("all");
  });
}

/** @deprecated use getRoomSiteFeatures */
export function getCabinFeatures(room: PublicRoom) {
  return getRoomSiteFeatures(room);
}
