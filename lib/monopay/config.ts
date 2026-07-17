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
