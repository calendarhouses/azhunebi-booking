import "server-only";

import { gasPost } from "@/lib/gas-api";
import { toDateKeyKyiv } from "./formatters";

export type TelegramMessageRef = {
  chatId: string | number;
  messageId: number;
};

export type TelegramTurnoversStateDay = {
  arrivals?: Record<string, TelegramMessageRef>;
  departures?: Record<string, TelegramMessageRef>;
  cleaning?: Record<string, TelegramMessageRef>;
};

export type TelegramTurnoversState = Record<string, TelegramTurnoversStateDay>;

/** null = remove this key from stored state (after deleting Telegram message). */
export type TelegramTurnoversStatePatch = {
  arrivals?: Record<string, TelegramMessageRef | null>;
  departures?: Record<string, TelegramMessageRef | null>;
  cleaning?: Record<string, TelegramMessageRef | null>;
};

function reviewWebhookSecret(): string {
  return (
    process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    ""
  );
}

export async function upsertTelegramTurnoversState(
  day: string | Date,
  patch: TelegramTurnoversStatePatch
): Promise<void> {
  const dayKey = toDateKeyKyiv(day);
  if (!dayKey) return;

  try {
    await gasPost({
      action: "telegramUpsertTurnoversState",
      day: dayKey,
      patch,
      webhookSecret: reviewWebhookSecret(),
    });
  } catch (err) {
    // Don't block Telegram messages if settings persistence fails.
    console.warn("[TG turnovers] state upsert failed", err);
  }
}

