/**
 * Синхронізація React-стану з window.* для поступового переносу legacy onclick-логіки.
 * Наступний етап: прибрати window.* і передавати все через props/context.
 */

import type { BookingRecord, AdminSettingsPayload } from "./types";

declare global {
  interface Window {
    BOSO_API_URL?: string;
    allBookings?: BookingRecord[];
    roomsList?: AdminSettingsPayload["roomsList"];
    discountsList?: AdminSettingsPayload["discountsList"];
    customServicesList?: AdminSettingsPayload["customServicesList"];
    sysServicesList?: AdminSettingsPayload["sysServicesList"];
    customPrices?: AdminSettingsPayload["customPrices"];
    restrictions?: AdminSettingsPayload["restrictions"];
    closedDates?: AdminSettingsPayload["closedDates"];
    transactions?: AdminSettingsPayload["transactions"];
    branding?: AdminSettingsPayload["branding"];
    switchView?: (view: string) => void;
    toggleSettingsMenu?: () => void;
    switchSettingsTab?: (tab: string, el?: HTMLElement) => void;
    renderTable?: (data: BookingRecord[]) => void;
    renderTimeline?: (silent?: boolean) => void;
    renderGuests?: (search?: string) => void;
    calculateAnalytics?: () => void;
    showToast?: (message: string) => void;
    openNewBookingDrawer?: (
      room?: string | null,
      checkIn?: string | null,
      checkOut?: string | null
    ) => void;
    openDetailsByRow?: (event: unknown, row: number | string) => void;
    setPageTitle?: (text: string, iconPath: string) => void;
  }
}

export function syncLegacyGlobals(payload: {
  bookings: BookingRecord[];
  settings: AdminSettingsPayload;
}) {
  if (typeof window === "undefined") return;
  window.allBookings = payload.bookings;
  if (payload.settings.roomsList) window.roomsList = payload.settings.roomsList;
  if (payload.settings.discountsList) window.discountsList = payload.settings.discountsList;
  if (payload.settings.customServicesList)
    window.customServicesList = payload.settings.customServicesList;
  if (payload.settings.sysServicesList) window.sysServicesList = payload.settings.sysServicesList;
  if (payload.settings.customPrices) window.customPrices = payload.settings.customPrices;
  if (payload.settings.restrictions) window.restrictions = payload.settings.restrictions;
  if (payload.settings.closedDates) window.closedDates = payload.settings.closedDates;
  if (payload.settings.transactions) window.transactions = payload.settings.transactions;
  if (payload.settings.branding) window.branding = payload.settings.branding;
}

export function showToast(message: string) {
  if (typeof window === "undefined") return;
  const container = document.getElementById("toast-container");
  if (!container) {
    console.log("[toast]", message);
    return;
  }
  container.innerHTML = "";
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      if (container.contains(toast)) toast.remove();
    }, 400);
  }, 3000);
}

const ALERT_CIRCLE_ICON = `<svg class="toast-icon toast-icon--warning" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke-width="2"/><path stroke-linecap="round" stroke-width="2" d="M12 8v4"/><path stroke-linecap="round" stroke-width="2" d="M12 16h.01"/></svg>`;

/** Тост для помилок (жовтий/warning стиль, без зеленої галочки). */
export function showErrorToast(message: string) {
  if (typeof window === "undefined") return;
  const container = document.getElementById("toast-container");
  if (!container) {
    console.error("[toast-error]", message);
    return;
  }
  container.innerHTML = "";
  const toast = document.createElement("div");
  toast.className = "toast toast--warning";
  const safe = String(message || "Помилка")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  toast.innerHTML = `${ALERT_CIRCLE_ICON} ${safe}`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      if (container.contains(toast)) toast.remove();
    }, 400);
  }, 4500);
}

export function formatAdminSyncError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Невідома помилка";
  const msg = String(raw || "").trim();
  if (!msg) return "Не вдалося зберегти. Спробуйте ще раз.";
  const lower = msg.toLowerCase();
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed") ||
    lower.includes("network request failed")
  ) {
    return "Немає зв'язку з сервером. Перевірте інтернет або повторіть через хвилину (можливо йде деплой).";
  }
  if (lower.includes("invalid json") || lower.includes("empty response")) {
    return "Сервер тимчасово недоступний (деплой або перезапуск). Спробуйте ще раз.";
  }
  if (msg.length > 120) return `${msg.slice(0, 117)}…`;
  return msg;
}
export function showPublishingToast(message: string) {
  if (typeof window === "undefined") return;
  const container = document.getElementById("toast-container");
  if (!container) {
    console.log("[publishing-toast]", message);
    return;
  }
  container.innerHTML = "";
  const toast = document.createElement("div");
  toast.className = "toast toast--warning";
  toast.innerHTML = `${ALERT_CIRCLE_ICON}<span class="toast-message">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      if (container.contains(toast)) toast.remove();
    }, 400);
  }, 4500);
}

export const PAGE_TITLES: Record<string, { title: string; icon: string }> = {
  list: {
    title: "Усі броні",
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />',
  },
  grid: {
    title: "Шахматка",
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />',
  },
  guests: {
    title: "Гості",
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />',
  },
  reports: {
    title: "Аналітика та Фінанси",
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />',
  },
};
