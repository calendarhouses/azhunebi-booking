import type { LucideIcon } from "lucide-react";
import {
  Baby,
  BedDouble,
  Bike,
  BookOpen,
  Camera,
  Car,
  ChefHat,
  Coffee,
  Compass,
  Droplet,
  Fence,
  Flame,
  Flower2,
  Heart,
  KeyRound,
  Lamp,
  MapPin,
  Microwave,
  Moon,
  Mountain,
  Music,
  PawPrint,
  Plane,
  Refrigerator,
  ShowerHead,
  Sofa,
  Sparkles,
  Star,
  Sun,
  Trees,
  Tv,
  Utensils,
  Waves,
  Wifi,
  Wind,
  Wine,
} from "lucide-react";
import type { RoomSiteHighlight } from "@/components/admin/desktop/types";

export type HighlightIconOption = {
  id: string;
  Icon: LucideIcon;
  template: string;
};

/** 3 групи × 12 унікальних іконок */
export const HIGHLIGHT_SLOT_OPTIONS: HighlightIconOption[][] = [
  [
    { id: "s0_flame", Icon: Flame, template: "Власна BBQ-зона для теплих вечорів під зорями" },
    { id: "s0_coffee", Icon: Coffee, template: "Кавомашина для ідеального ранку на терасі" },
    { id: "s0_mountain", Icon: Mountain, template: "Панорамний вид на гори, що надихає щомиті" },
    { id: "s0_waves", Icon: Waves, template: "Власний чан на дровах під відкритим небом" },
    { id: "s0_trees", Icon: Trees, template: "Приватна територія в абсолютній гармонії з природою" },
    { id: "s0_bed", Icon: BedDouble, template: "Королівське ліжко з преміальною білизною для солодких снів" },
    { id: "s0_wifi", Icon: Wifi, template: "Швидкісний Starlink для роботи та кіновечорів" },
    { id: "s0_tv", Icon: Tv, template: "Величезний Smart TV з доступом до Netflix" },
    { id: "s0_car", Icon: Car, template: "Безпечний приватний паркінг для вашого авто" },
    { id: "s0_sparkles", Icon: Sparkles, template: "Естетика та преміальні деталі у кожному куточку" },
    { id: "s0_wine", Icon: Wine, template: "Ідеальна атмосфера для романтичних побачень" },
    { id: "s0_utensils", Icon: Utensils, template: "Сучасна кухня для ваших кулінарних шедеврів" },
  ],
  [
    { id: "s1_sun", Icon: Sun, template: "Залита сонцем тераса для ранкових медитацій" },
    { id: "s1_moon", Icon: Moon, template: "Абсолютна тиша і темрява для глибокого відновлення" },
    { id: "s1_wind", Icon: Wind, template: "Кришталево чисте повітря прямо у вашій спальні" },
    { id: "s1_drop", Icon: Droplet, template: "Джерельна вода та ідеальний мікроклімат" },
    { id: "s1_shower", Icon: ShowerHead, template: "Тропічний душ з преміальною косметикою" },
    { id: "s1_fridge", Icon: Refrigerator, template: "Холодильник для ваших улюблених напоїв та снеків" },
    { id: "s1_microwave", Icon: Microwave, template: "Уся необхідна техніка для максимальної зручності" },
    { id: "s1_chef", Icon: ChefHat, template: "Простір, де готувати — це суцільне задоволення" },
    { id: "s1_couch", Icon: Sofa, template: "Затишна лаунж-зона для неспішних розмов" },
    { id: "s1_baby", Icon: Baby, template: "Безпечний та комфортний простір для відпочинку з дітьми" },
    { id: "s1_paw", Icon: PawPrint, template: "Ретрит, куди можна приїхати з улюбленими хвостиками" },
    { id: "s1_key", Icon: KeyRound, template: "Безконтактний заїзд для вашої повної приватності" },
  ],
  [
    { id: "s2_heart", Icon: Heart, template: "Простір, створений з любов'ю до кожної деталі" },
    { id: "s2_star", Icon: Star, template: "Сервіс найвищого рівня для вибагливих гостей" },
    { id: "s2_map", Icon: MapPin, template: "Ідеальна локація далеко від міського шуму" },
    { id: "s2_compass", Icon: Compass, template: "Ідеальна точка відліку для ваших нових пригод" },
    { id: "s2_camera", Icon: Camera, template: "Інстаграмні краєвиди з кожного вікна" },
    { id: "s2_music", Icon: Music, template: "Якісна акустика для вашого ідеального плейлиста" },
    { id: "s2_book", Icon: BookOpen, template: "Затишний куточок для читання та роздумів" },
    { id: "s2_lamp", Icon: Lamp, template: "М'яке вечірнє освітлення для повного релаксу" },
    { id: "s2_fence", Icon: Fence, template: "Повністю закрита територія для вашого спокою" },
    { id: "s2_flower", Icon: Flower2, template: "Доглянутий ландшафт і пахощі трав" },
    { id: "s2_bike", Icon: Bike, template: "Велосипеди для активних прогулянок околицями" },
    { id: "s2_plane", Icon: Plane, template: "Легкий трансфер та допомога в логістиці" },
  ],
];

const LEGACY_ICON_IDS: Record<string, string> = {
  s1_droplets: "s1_drop",
  s1_armchair: "s1_couch",
};

const ALL_TEMPLATES = new Set<string>();
const OPTION_BY_ID = new Map<string, HighlightIconOption>();
for (const slot of HIGHLIGHT_SLOT_OPTIONS) {
  for (const opt of slot) {
    OPTION_BY_ID.set(opt.id, opt);
    ALL_TEMPLATES.add(opt.template.trim());
  }
}

export const HIGHLIGHT_SLOT_COUNT = 3;

export function getSlotHighlightOptions(slotIndex: number): HighlightIconOption[] {
  return HIGHLIGHT_SLOT_OPTIONS[slotIndex] ?? HIGHLIGHT_SLOT_OPTIONS[0];
}

export function getHighlightIconOption(
  iconId: string | undefined,
  slotIndex?: number
): HighlightIconOption {
  const resolvedId = iconId ? (LEGACY_ICON_IDS[iconId] ?? iconId) : iconId;
  if (resolvedId && OPTION_BY_ID.has(resolvedId)) {
    return OPTION_BY_ID.get(resolvedId)!;
  }
  if (slotIndex != null) {
    return getSlotHighlightOptions(slotIndex)[0];
  }
  return HIGHLIGHT_SLOT_OPTIONS[0][0];
}

export function emptySiteHighlights(): RoomSiteHighlight[] {
  return HIGHLIGHT_SLOT_OPTIONS.map((slot) => ({
    iconId: slot[0].id,
    text: "",
  }));
}

function resolveIconIdForSlot(iconId: string | undefined, slotIndex: number): string {
  const mapped = iconId ? (LEGACY_ICON_IDS[iconId] ?? iconId) : undefined;
  const slotOptions = getSlotHighlightOptions(slotIndex);
  if (mapped && slotOptions.some((o) => o.id === mapped)) {
    return mapped;
  }
  return slotOptions[0].id;
}

export function normalizeSiteHighlights(
  raw: RoomSiteHighlight[] | undefined | null
): RoomSiteHighlight[] {
  const base = emptySiteHighlights();
  if (!raw?.length) return base;
  return base.map((slot, index) => {
    const item = raw[index];
    if (!item) return slot;
    return {
      iconId: resolveIconIdForSlot(item.iconId, index),
      text: item.text ?? "",
    };
  });
}

export function siteHighlightsForSave(rows: RoomSiteHighlight[]): RoomSiteHighlight[] {
  return normalizeSiteHighlights(rows)
    .map((row) => ({
      iconId: row.iconId,
      text: row.text.trim(),
    }))
    .filter((row) => row.text.length > 0);
}

export function shouldAutofillHighlightText(
  currentText: string,
  previousIconId: string | undefined,
  slotIndex: number
): boolean {
  const trimmed = currentText.trim();
  if (!trimmed) return true;
  const prev = getHighlightIconOption(previousIconId, slotIndex);
  return trimmed === prev.template.trim() || ALL_TEMPLATES.has(trimmed);
}

export function getHighlightIconOptionById(iconId: string): HighlightIconOption {
  return getHighlightIconOption(iconId);
}
