/** Client-safe Mono Chast / acquiring booking detection (no secrets). */

export type MonoChastAmountKind = "prepay" | "full";

/** Markers in monoPageUrl (no Mono checkout URL for ПЧ). */
export const MONO_CHAST_PAGE_PREPAY = "chast:prepay";
export const MONO_CHAST_PAGE_FULL = "chast:full";
/** @deprecated legacy marker = full */
export const MONO_CHAST_PAGE_MARKER = MONO_CHAST_PAGE_FULL;

export function monoChastPageMarker(kind: MonoChastAmountKind): string {
  return kind === "prepay" ? MONO_CHAST_PAGE_PREPAY : MONO_CHAST_PAGE_FULL;
}

export function parseMonoChastAmountKind(
  monoPageUrl?: string
): MonoChastAmountKind | null {
  const page = String(monoPageUrl || "").trim();
  if (page === MONO_CHAST_PAGE_PREPAY || page.startsWith("chast:prepay")) {
    return "prepay";
  }
  if (
    page === MONO_CHAST_PAGE_FULL ||
    page === "chast:parts" ||
    page.startsWith("chast:full") ||
    page.startsWith("chast:parts")
  ) {
    return "full";
  }
  if (page.startsWith("chast:")) return "full";
  return null;
}

export function isMonoChastBooking(booking: {
  monoPageUrl?: string;
  monoInvoiceId?: string;
}): boolean {
  return parseMonoChastAmountKind(booking.monoPageUrl) != null;
}

export function isMonoAcquiringBooking(booking: {
  monoPageUrl?: string;
}): boolean {
  const page = String(booking.monoPageUrl || "").trim();
  return /^https:\/\//i.test(page);
}

export const MONO_CHAST_PROVIDER = "Mono ПЧ";
export const MONO_CHAST_PROVIDER_PREPAY = "Mono ПЧ передплата";
export const MONO_CHAST_PROVIDER_FULL = "Mono ПЧ повна";
