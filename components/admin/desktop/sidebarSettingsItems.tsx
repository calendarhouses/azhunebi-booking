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
    label: "Моя сторінка",
    icon: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      </>
    ),
  },
  {
    tab: "rooms",
    label: "Моє житло",
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
    tab: "services",
    label: "Додаткові послуги",
    icon: (
      <>
        <path d="M12 3v3" />
        <path d="M8 6h8" />
        <rect x="5" y="9" width="14" height="10" rx="2" />
        <path d="M9 13h6" />
      </>
    ),
  },
  {
    tab: "channels",
    label: "Канали",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M8 2v4M16 2v4M3 10h18" />
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
    label: "Правила",
    icon: (
      <>
        <circle cx="12" cy="12" r="7" />
        <path d="m8.5 8.5 7 7" />
      </>
    ),
  },
  {
    tab: "sms",
    label: "SMS",
    icon: (
      <>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4 3v-3H6.5A2.5 2.5 0 0 1 4 13.5v-7Z" />
        <path d="M8 9h8M8 12h5" />
      </>
    ),
  },
  {
    tab: "team",
    label: "Команда",
    icon: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
];
