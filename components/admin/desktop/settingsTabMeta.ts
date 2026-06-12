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
export const SETTINGS_FULL_WIDTH_TABS: SettingsTabName[] = ["rooms", "prices"];

export const SETTINGS_TAB_META: Record<SettingsTabName, SettingsTabMeta> = {
  branding: {
    title: "Сторінка хати",
    icon: '<circle cx="12" cy="8" r="3.5" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />',
  },
  rooms: {
    title: "Твоє житло",
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
    title: "Правила заїзду",
    icon: '<circle cx="12" cy="12" r="7" /><path stroke-linecap="round" stroke-linejoin="round" d="m8.5 8.5 7 7" />',
  },
};

export function getSettingsTabPageMeta(tab: SettingsTabName): SettingsTabMeta {
  return SETTINGS_TAB_META[tab];
}
