import "server-only";

const MONO_API_ORIGIN = "https://api.monobank.ua";
const DEFAULT_PUBLIC_ORIGIN = "https://azhunebi.com";

export function requireMonoAcquiringToken(): string {
  const token = process.env.MONO_ACQUIRING_TOKEN?.trim();
  if (!token) {
    throw new Error("MONO_ACQUIRING_TOKEN is not configured");
  }
  return token;
}

export function getMonoApiOrigin(): string {
  return process.env.MONO_ACQUIRING_API_URL?.trim() || MONO_API_ORIGIN;
}

function isProductionRuntime(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

/** Canonical public site origin for Mono redirect/webhook + SMS pay links. */
export function getPublicOrigin(): string {
  const raw =
    process.env.MONO_PUBLIC_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    DEFAULT_PUBLIC_ORIGIN;

  try {
    const url = new URL(raw);
    if (isProductionRuntime()) {
      if (url.protocol !== "https:") {
        console.error("[Mono] Refusing non-https public origin in production:", raw);
        return DEFAULT_PUBLIC_ORIGIN;
      }
      if (
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname.endsWith(".local")
      ) {
        console.error("[Mono] Refusing localhost public origin in production:", raw);
        return DEFAULT_PUBLIC_ORIGIN;
      }
    }
    return url.origin;
  } catch {
    return DEFAULT_PUBLIC_ORIGIN;
  }
}

/**
 * Test charge override — hard-disabled in production unless
 * MONO_ALLOW_TEST_AMOUNT=true (emergency only).
 */
export function getMonoTestAmountUah(): number | null {
  if (isProductionRuntime() && process.env.MONO_ALLOW_TEST_AMOUNT !== "true") {
    if (process.env.MONO_TEST_AMOUNT_UAH?.trim()) {
      console.error(
        "[Mono] MONO_TEST_AMOUNT_UAH is set but ignored in production (set MONO_ALLOW_TEST_AMOUNT=true to force)"
      );
    }
    return null;
  }
  const raw = process.env.MONO_TEST_AMOUNT_UAH?.trim();
  if (!raw) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

export function resolveMonoChargeAmountUah(expectedAmountUah: number): number {
  return getMonoTestAmountUah() ?? expectedAmountUah;
}
