/** Stroke-іконки для сайдбару (розгорнутий і згорнутий). */
const iconProps = {
  className: "menu-icon",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
};

export const EXPANDED_MENU_ICONS = {
  grid: (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  ),
  list: (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M4.25 6.75h.01M4.25 12h.01M4.25 17.25h.01" />
    </svg>
  ),
  guests: (
    <svg {...iconProps}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
      />
    </svg>
  ),
  settings: (
    <svg {...iconProps}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 3.5h3l.6 2.1a1.4 1.4 0 0 0 .7.8l1.9.9 2-1.1 1.5 2.6-1.6 1.4a1.4 1.4 0 0 0-.4.9v2.2c0 .3.1.7.4.9l1.6 1.4-1.5 2.6-2-1.1-1.9.9a1.4 1.4 0 0 0-.7.8l-.6 2.1h-3l-.6-2.1a1.4 1.4 0 0 0-.7-.8l-1.9-.9-2 1.1-1.5-2.6 1.6-1.4c.3-.2.4-.6.4-.9v-2.2c0-.3-.1-.7-.4-.9L3.4 8.8l1.5-2.6 2 1.1 1.9-.9a1.4 1.4 0 0 0 .7-.8l.6-2.1Z"
      />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  ),
  reports: (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 20h14M7 17v-4m5 4V8m5 9v-6" />
    </svg>
  ),
  logout: (
    <svg {...iconProps}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
      />
    </svg>
  ),
} as const;

export type SidebarNavIconKey = keyof typeof EXPANDED_MENU_ICONS;

export const COLLAPSED_MAIN_NAV = [
  {
    id: "grid",
    view: "grid" as const,
    label: "Шахматка",
    hint: "Календар бронювань по днях",
    icon: "grid" as const,
    elementId: "menu-grid",
  },
  {
    id: "list",
    view: "list" as const,
    label: "Усі броні",
    hint: "Список усіх бронювань",
    icon: "list" as const,
    elementId: "menu-list",
  },
  {
    id: "guests",
    view: "guests" as const,
    label: "Гості",
    hint: "База гостей та контакти",
    icon: "guests" as const,
    elementId: "menu-guests",
  },
] as const;
