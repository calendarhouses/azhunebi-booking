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

/** Палітра ручних кольорів броні на шаховатці (пастельні / soft). */
export const BOOKING_COLOR_SWATCHES = [
  "#FDA4AF", // rose-300
  "#FDBA74", // orange-300
  "#FDE68A", // amber-200
  "#6EE7B7", // emerald-300
  "#5EEAD4", // teal-300
  "#7DD3FC", // sky-300
  "#A5B4FC", // indigo-300
  "#F0ABFC", // fuchsia-300
  "#D6D3D1", // stone-300
  "#CBD5E1", // slate-300
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

/** Непрозорий pastel: змішування акценту з білим (без просвічування). */
function mixHexWithWhite(hex: string, whiteRatio: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const colorRatio = 1 - whiteRatio;
  const mix = (channel: number) => Math.round(channel * colorRatio + 255 * whiteRatio);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

/** Легкий pastel-tint для drawer/modal під обраний або статусний колір. */
export function bookingAccentTintStyle(accentHex: string): CSSProperties {
  return {
    ["--booking-accent" as string]: accentHex,
    ["--booking-tint-bg" as string]: mixHexWithWhite(accentHex, 0.92),
    ["--booking-tint-header" as string]: mixHexWithWhite(accentHex, 0.86),
    ["--booking-tint-border" as string]: mixHexWithWhite(accentHex, 0.72),
    ["--booking-tint-section" as string]: "#FFFFFF",
  } as CSSProperties;
}
