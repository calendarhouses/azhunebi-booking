import type { ReactNode } from "react";
import { AMENITIES_CATEGORIES } from "@/constants/amenitiesDict";
import type { PublicDiscount, PublicRoom } from "./types";
import { DesktopIcons } from "./desktopIcons";

export type AmenityItem = { icon: ReactNode; label: string };
export type AmenityCategoryBlock = {
  id: string;
  title: string;
  items: AmenityItem[];
};

const CABIN_COPY: Record<
  number,
  { description: string; amenities: AmenityItem[] }
> = {
  1: {
    description:
      "Усередині на тебе чекають: затишна спальня для солодких снів під звуки природи, світла кухня-вітальня, сучасна ванна кімната та неймовірний панорамний вид на озеро, який надихає щоранку.",
    amenities: [
      { icon: DesktopIcons.bed, label: "Затишна спальня" },
      { icon: DesktopIcons.kit, label: "Світла кухня-вітальня" },
      { icon: DesktopIcons.bath, label: "Сучасна ванна кімната" },
      { icon: DesktopIcons.grill, label: "Власна BBQ-зона з грилем" },
      { icon: DesktopIcons.win, label: "Панорамний вид на озеро" },
    ],
  },
  2: {
    description:
      "Котедж №2 — це ідеальне поєднання сучасного скандинавського стилю та домашнього затишку. Створений для тих, хто шукає тиші та романтики на самому березі озера.",
    amenities: [
      { icon: DesktopIcons.win, label: "Простора вітальня" },
      { icon: DesktopIcons.kit, label: "Кухня з технікою" },
      { icon: DesktopIcons.bed, label: "Дві окремі спальні" },
      { icon: DesktopIcons.bath, label: "Ванна та господ. кімната" },
      { icon: DesktopIcons.grill, label: "Тераса під навісом із мангалом" },
    ],
  },
  3: {
    description:
      "Просторий сімейний котедж із зоною відпочинку, окремими спальнями та терасою для вечірніх посидень біля мангалу.",
    amenities: [
      { icon: DesktopIcons.win, label: "Світла вітальня" },
      { icon: DesktopIcons.bed, label: "Окремі спальні" },
      { icon: DesktopIcons.grill, label: "Тераса з мангалом" },
      { icon: DesktopIcons.bath, label: "Сучасна ванна" },
      { icon: DesktopIcons.kit, label: "Повністю обладнана кухня" },
    ],
  },
  4: {
    description:
      "Романтичний котедж із панорамними вікнами, спальнею з видом на зорі та власною BBQ-зоною на терасі.",
    amenities: [
      { icon: DesktopIcons.win, label: "Панорамні вікна" },
      { icon: DesktopIcons.bath, label: "Ванна з тропічним душем" },
      { icon: DesktopIcons.grill, label: "BBQ-зона на терасі" },
      { icon: DesktopIcons.bed, label: "Затишна спальня" },
      { icon: DesktopIcons.kit, label: "Кухня-вітальня" },
    ],
  },
};

export function getCabinFeatures(room: PublicRoom) {
  // Для backward-compat: якщо немає amenities з адмінки, використовуємо старий текстовий контент.
  const hasStructuredAmenities = !!room.amenities;
  if (!hasStructuredAmenities) {
    const name = room.name.toUpperCase();
    if (name.includes("JUNIOR") || name.includes("1") || name.includes("№1")) {
      return [
        { icon: DesktopIcons.bed, label: "Затишна спальня для солодких снів під звуки природи" },
        { icon: DesktopIcons.win, label: "Неймовірний панорамний вид на озеро, що надихає щоранку" },
        { icon: DesktopIcons.grill, label: "Власна BBQ-зона з газовим грилем прямо на терасі" },
      ];
    }
    if (name.includes("№2") || name.includes(" 2") || name.endsWith("2")) {
      return [
        { icon: DesktopIcons.win, label: "Простора вітальня з великими панорамними вікнами" },
        { icon: DesktopIcons.bed, label: "Дві окремі спальні (одна з персональним виходом)" },
        {
          icon: DesktopIcons.grill,
          label: "Тераса під навісом із мангалом (дрова та вугілля включено)",
        },
      ];
    }
    if (name.includes("№4") || name.includes(" 4") || name.endsWith("4")) {
      return [
        {
          icon: DesktopIcons.win,
          label: "Спальня з ліжком, крізь яке можна милуватися нічним зоряним небом",
        },
        {
          icon: DesktopIcons.bath,
          label: "Розкішна ванна кімната з дзеркалом та тропічним душем",
        },
        {
          icon: DesktopIcons.grill,
          label: "Власна BBQ-зона на терасі, де вже є все для смаження",
        },
      ];
    }
    return [
      { icon: DesktopIcons.win, label: "Світла вітальня для зустрічей усією родиною" },
      { icon: DesktopIcons.bed, label: "Окремі спальні з ортопедичними матрацами" },
      { icon: DesktopIcons.grill, label: "Велика тераса з мангалом" },
    ];
  }

  const { featured } = buildPublicAmenities(room);
  return featured.length
    ? featured
    : [
        { icon: DesktopIcons.win, label: "Затишний котедж з усім необхідним для відпочинку" },
      ];
}

export function getRoomDescription(room: PublicRoom): string {
  if (room.detailedDescription && room.detailedDescription.trim().length > 0) {
    return room.detailedDescription.trim();
  }
  const copy = CABIN_COPY[room.id];
  if (copy?.description) return copy.description;
  const desc = (room.desc || "").trim();
  return desc || "Комфортний відпочинок на природі в сучасному котеджі.";
}

export function getRoomAmenities(room: PublicRoom): AmenityItem[] {
  // Якщо є структуровані зручності з адмінки – показуємо всі активні.
  if (room.amenities) {
    const { all } = buildPublicAmenities(room);
    if (all.length) return all;
  }

  const copy = CABIN_COPY[room.id];
  if (copy?.amenities?.length) return copy.amenities;
  return [
    { icon: DesktopIcons.bed, label: "Затишна спальня" },
    { icon: DesktopIcons.win, label: "Панорамний вид" },
    { icon: DesktopIcons.grill, label: "BBQ-зона" },
    { icon: DesktopIcons.bath, label: "Ванна кімната" },
  ];
}

export function buildPublicAmenities(
  room: PublicRoom
): { featured: AmenityItem[]; byCategory: AmenityCategoryBlock[]; all: AmenityItem[] } {
  const src = room.amenities;
  if (!src) {
    const fallback = getRoomAmenities(room);
    return { featured: [], byCategory: [], all: fallback };
  }

  const featured: AmenityItem[] = [];
  const byCategory: AmenityCategoryBlock[] = [];
  const all: AmenityItem[] = [];

  const iconFor = (categoryId: string, amenityId: string): ReactNode => {
    if (categoryId === "bathroom") return DesktopIcons.bath;
    if (categoryId === "kitchen") return DesktopIcons.kit;
    if (categoryId === "view") return DesktopIcons.win;
    if (categoryId === "outdoor") return DesktopIcons.grill;
    if (categoryId === "spa") return DesktopIcons.bath;
    if (categoryId === "comfort") return DesktopIcons.win;
    return DesktopIcons.bullet ?? DesktopIcons.win;
  };

  for (const cat of AMENITIES_CATEGORIES) {
    const items = src[cat.id] || [];
    const activeItems = items.filter((i) => i && i.isActive);
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
        icon: iconFor(cat.id, item.id),
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
  const filtered = discounts.filter((d) => {
    if (d.roomsIds?.length) {
      return d.roomsIds.includes("all") || d.roomsIds.includes(String(roomId));
    }
    const rooms = (d.rooms || "").toLowerCase();
    return rooms.includes("всі") || rooms.includes("all");
  });
  if (filtered.length) return filtered;
  return [
    { id: 1, condition: "Від 2 діб", discount: "15%" },
    { id: 2, condition: "Від 3 діб", discount: "20%" },
    { id: 3, condition: "Від 7 діб", discount: "43%" },
    { id: 4, condition: "Від 14 діб", discount: "57%" },
  ];
}

/** Плейсхолдер «вільних дат» до підключення API */
export function getNextFreeLabel(): string {
  return "перевірте дати";
}
