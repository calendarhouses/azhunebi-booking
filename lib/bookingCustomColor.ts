import type { CSSProperties } from "react";

/** Акцентні кольори за статусом (шахматка + tint модалки). */
export const BOOKING_STATUS_ACCENT = {
  paid: "#22C55E",
  confirmed: "#38BDF8",
  new: "#60A5FA",
  cancelled: "#9CA3AF",
  pendingReview: "#9CA3AF",
  hutshub: "#7FA896",
  default: "#94A3B8",
} as const;

/** Палітра ручних кольорів броні на шаховатці. */
export const BOOKING_COLOR_SWATCHES = [
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#14B8A6", // teal
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#78716C", // stone
  "#0F172A", // slate
] as const;

export type BookingColorSwatch = (typeof BOOKING_COLOR_SWATCHES)[number];

export function normalizeBookingCustomColor(
  value: unknown
): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const hex = raw.startsWith("#") ? raw : `#${raw}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return null;
  return hex.toUpperCase();
}

/** Текст на кольоровій картці: світлий або темний залежно від фону. */
export function bookingColorForeground(hex: string): "#FFFFFF" | "#1A1A1A" {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#1A1A1A" : "#FFFFFF";
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Легкий pastel-tint для drawer/modal під обраний або статусний колір. */
export function bookingAccentTintStyle(accentHex: string): CSSProperties {
  return {
    ["--booking-accent" as string]: accentHex,
    ["--booking-tint-bg" as string]: hexToRgba(accentHex, 0.07),
    ["--booking-tint-header" as string]: hexToRgba(accentHex, 0.11),
    ["--booking-tint-border" as string]: hexToRgba(accentHex, 0.2),
    ["--booking-tint-section" as string]: "rgba(255, 255, 255, 0.72)",
  } as CSSProperties;
}
