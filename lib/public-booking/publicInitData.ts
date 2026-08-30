import { toPublicInitPaymentSettings } from "@/lib/payment/paymentSettings";
import { normalizeRoomCategories } from "@/lib/admin/roomCategories";

/** Keys safe to expose via public initData (calendar / booking UI). */
export const PUBLIC_SETTINGS_KEYS = [
  "branding",
  "closedDates",
  "customPrices",
  "customServicesList",
  "discountsList",
  "flexibleScheduleSettings",
  "restrictions",
  "roomsList",
  "roomCategoriesList",
  "sysServicesList",
  "paymentSettings",
] as const;

export type PublicSettingsKey = (typeof PUBLIC_SETTINGS_KEYS)[number];

/** Keep only early/late tokens needed for public calendar gap logic. */
export function sanitizePublicBookingComment(raw: string | undefined | null): string {
  const text = String(raw || "");
  const early =
    text.match(/🕒#early⏳:\s*(\d{2}:\d{2})/)?.[1] ||
    text.match(/🕒#early:\s*(\d{2}:\d{2})/)?.[1] ||
    text.match(/🕒\s*Ранній заїзд:\s*з\s*(\d{2}:\d{2})/)?.[1] ||
    null;
  const late =
    text.match(/🕒#late⏳:\s*(\d{2}:\d{2})/)?.[1] ||
    text.match(/🕒#late:\s*(\d{2}:\d{2})/)?.[1] ||
    text.match(/🕒\s*Пізній виїзд:\s*до\s*(\d{2}:\d{2})/)?.[1] ||
    null;
  const parts: string[] = [];
  if (early) parts.push(`🕒#early⏳: ${early}`);
  if (late) parts.push(`🕒#late⏳: ${late}`);
  return parts.join(" | ");
}

export function pickPublicSettings(
  settings: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_SETTINGS_KEYS) {
    if (key === "paymentSettings") continue;
    if (key === "roomCategoriesList") continue;
    if (key in settings) out[key] = settings[key];
  }
  out.roomCategoriesList = normalizeRoomCategories(settings.roomCategoriesList);
  // Always include sanitized payment flags (even when row missing → legacy env).
  out.paymentSettings = toPublicInitPaymentSettings(settings.paymentSettings);
  return out;
}
