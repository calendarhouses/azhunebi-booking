import type { SettingsTabName } from "./types";

export type SettingsTabMeta = {
  title: string;
  /** SVG-вміст для DesktopHeader (paths у viewBox 0 0 24 24) */
  icon: string;
  /** Іконка ХАТА (fill), як у «Запуск хати» */
  iconVariant?: "khata";
};

/** Вкладки, де білий блок вужчий за шириною форми */
export const SETTINGS_FIT_CONTENT_TABS: SettingsTabName[] = ["branding"];

/** Вкладки: повна ширина як шапка, висота за контентом */
export const SETTINGS_FULL_WIDTH_TABS: SettingsTabName[] = [
  "rooms",
  "prices",
  "restrictions",
  "payment",
  "sms",
  "team",
];

export const SETTINGS_TAB_META: Record<SettingsTabName, SettingsTabMeta> = {
  branding: {
    title: "Моя сторінка",
    icon: '<circle cx="12" cy="8" r="3.5" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />',
  },
  rooms: {
    title: "Моє житло",
    icon: "",
    iconVariant: "khata",
  },
  prices: {
    title: "Ціни та тарифи",
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 18h16" /><path stroke-linecap="round" stroke-linejoin="round" d="M7 18V9m5 9V6m5 12v-7" /><path stroke-linecap="round" stroke-linejoin="round" d="M6 9h2m4-3h2m4 5h2" />',
  },
  discounts: {
    title: "Знижки",
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.5 9.5h.01M14.5 14.5h.01" /><path stroke-linecap="round" stroke-linejoin="round" d="M5 7V5h2l12 12-2 2L5 7Z" />',
  },
  restrictions: {
    title: "Правила",
    icon: '<circle cx="12" cy="12" r="7" /><path stroke-linecap="round" stroke-linejoin="round" d="m8.5 8.5 7 7" />',
  },
  services: {
    title: "Додаткові послуги",
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v3" /><path stroke-linecap="round" stroke-linejoin="round" d="M8 6h8" /><rect x="5" y="9" width="14" height="10" rx="2" /><path stroke-linecap="round" stroke-linejoin="round" d="M9 13h6" />',
  },
  payment: {
    title: "Оплата",
    icon: '<rect x="3" y="6" width="18" height="12" rx="2" /><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18" /><path stroke-linecap="round" stroke-linejoin="round" d="M7 15h2" />',
  },
  sms: {
    title: "SMS",
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4 3v-3H6.5A2.5 2.5 0 0 1 4 13.5v-7Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M8 9h8M8 12h5" />',
  },
  team: {
    title: "Команда",
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path stroke-linecap="round" stroke-linejoin="round" d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />',
  },
  activity: {
    title: "Команда",
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path stroke-linecap="round" stroke-linejoin="round" d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />',
  },
};

export function getSettingsTabPageMeta(tab: SettingsTabName): SettingsTabMeta {
  return SETTINGS_TAB_META[tab];
}
