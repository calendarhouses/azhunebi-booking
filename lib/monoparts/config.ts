import "server-only";

import { getPublicOrigin } from "@/lib/monopay/config";

export {
  type MonoChastAmountKind,
  MONO_CHAST_PAGE_PREPAY,
  MONO_CHAST_PAGE_FULL,
  MONO_CHAST_PAGE_MARKER,
  monoChastPageMarker,
  parseMonoChastAmountKind,
  isMonoChastBooking,
  isMonoAcquiringBooking,
  MONO_CHAST_PROVIDER,
  MONO_CHAST_PROVIDER_PREPAY,
  MONO_CHAST_PROVIDER_FULL,
} from "./bookingKind";

const MONO_CHAST_API_ORIGIN = "https://u2.monobank.com.ua";

export function isMonoPartsConfigured(): boolean {
  return Boolean(
    process.env.MONO_CHAST_STORE_ID?.trim() &&
      process.env.MONO_CHAST_SIGN_KEY?.trim()
  );
}

export function requireMonoChastStoreId(): string {
  const storeId = process.env.MONO_CHAST_STORE_ID?.trim();
  if (!storeId) throw new Error("MONO_CHAST_STORE_ID is not configured");
  return storeId;
}

export function requireMonoChastSignKey(): string {
  const key = process.env.MONO_CHAST_SIGN_KEY?.trim();
  if (!key) throw new Error("MONO_CHAST_SIGN_KEY is not configured");
  return key;
}

export function getMonoChastApiOrigin(): string {
  return process.env.MONO_CHAST_API_URL?.trim() || MONO_CHAST_API_ORIGIN;
}

export { getPublicOrigin };

/** Only 3 payments — per owner. */
export const MONO_CHAST_PARTS_COUNT = [3] as const;
