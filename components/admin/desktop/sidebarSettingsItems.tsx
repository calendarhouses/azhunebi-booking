import type { ReactNode } from "react";
import type { SettingsTabName } from "./types";

export type SidebarSettingsItem = {
  tab: SettingsTabName;
  label: string;
  icon: ReactNode;
};

export const SIDEBAR_SETTINGS_ITEMS: SidebarSettingsItem[] = [
  {
    tab: "branding",
    label: "Сторінка хати",
    icon: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      </>
    ),
  },
  {
    tab: "rooms",
    label: "Твоє житло",
    icon: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1v-9.5Z" />,
  },
  {
    tab: "prices",
    label: "Ціни та тарифи",
    icon: (
      <>
        <path d="M4 18h16" />
        <path d="M7 18V9m5 9V6m5 12v-7" />
        <path d="M6 9h2m4-3h2m4 5h2" />
      </>
    ),
  },
  {
    tab: "discounts",
    label: "Знижки",
    icon: (
      <>
        <path d="M9.5 9.5h.01M14.5 14.5h.01" />
        <path d="M5 7V5h2l12 12-2 2L5 7Z" />
      </>
    ),
  },
  {
    tab: "restrictions",
    label: "Правила заїзду",
    icon: (
      <>
        <circle cx="12" cy="12" r="7" />
        <path d="m8.5 8.5 7 7" />
      </>
    ),
  },
];
