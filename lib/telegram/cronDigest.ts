import "server-only";

/**
 * Fetch full bookings+settings for Telegram cron jobs.
 * Uses GAS action cronTelegramDigest authenticated via webhook secret.
 */
export type CronTelegramDigest = {
  bookings: Array<Record<string, unknown>>;
  settings: Record<string, unknown>;
};

export async function fetchCronTelegramDigest(): Promise<CronTelegramDigest> {
  const gasUrl = process.env.NEXT_PUBLIC_GAS_URL?.trim();
  if (!gasUrl) throw new Error("NEXT_PUBLIC_GAS_URL is not set");

  const secret =
    process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    "";
  if (!secret) throw new Error("TELEGRAM_REVIEW_WEBHOOK_SECRET is not set");

  const res = await fetch(gasUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "cronTelegramDigest",
      webhookSecret: secret,
    }),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as
    | (CronTelegramDigest & { error?: string })
    | null;
  if (!res.ok || !json || json.error) {
    throw new Error(json?.error || `GAS cron digest failed (${res.status})`);
  }
  return {
    bookings: Array.isArray(json.bookings) ? json.bookings : [],
    settings: json.settings && typeof json.settings === "object" ? json.settings : {},
  };
}
