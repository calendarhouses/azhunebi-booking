import "server-only";

import { gasPost } from "@/lib/gas-api";

/**
 * Fetch full bookings+settings for Telegram cron jobs.
 * Routes via DATA_SOURCE (Supabase or GAS).
 */
export type CronTelegramDigest = {
  bookings: Array<Record<string, unknown>>;
  settings: Record<string, unknown>;
};

export async function fetchCronTelegramDigest(): Promise<CronTelegramDigest> {
  const secret =
    process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    "";
  if (!secret) throw new Error("TELEGRAM_REVIEW_WEBHOOK_SECRET is not set");

  const json = await gasPost<CronTelegramDigest & { error?: string }>({
    action: "cronTelegramDigest",
    webhookSecret: secret,
  });

  if (json.error) {
    throw new Error(json.error);
  }
  return {
    bookings: Array.isArray(json.bookings) ? json.bookings : [],
    settings: json.settings && typeof json.settings === "object" ? json.settings : {},
  };
}
