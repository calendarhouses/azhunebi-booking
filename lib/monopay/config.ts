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

export function getPublicOrigin(): string {
  const raw =
    process.env.MONO_PUBLIC_ORIGIN?.trim() ||
    DEFAULT_PUBLIC_ORIGIN;

  try {
    const url = new URL(raw);
    return url.origin;
  } catch {
    return DEFAULT_PUBLIC_ORIGIN;
  }
}

export function getMonoTestAmountUah(): number | null {
  const raw = process.env.MONO_TEST_AMOUNT_UAH?.trim();
  if (!raw) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

export function resolveMonoChargeAmountUah(expectedAmountUah: number): number {
  return getMonoTestAmountUah() ?? expectedAmountUah;
}
