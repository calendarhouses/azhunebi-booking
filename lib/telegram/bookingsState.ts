import "server-only";

import { gasPost } from "@/lib/gas-api";

export type TelegramBookingMessageRef = {
  chatId: string | number;
  messageId: number;
};

export type TelegramBookingsStatePatch = Record<
  string,
  TelegramBookingMessageRef
>;

function reviewWebhookSecret(): string {
  return (
    process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    ""
  );
}

/**
 * Stores `chat_id/message_id` for paid booking notifications ("БРОНЮВАННЯ")
 * so later we can `editMessage` instead of sending new messages.
 */
export async function upsertTelegramBookingsState(
  patch: TelegramBookingsStatePatch
): Promise<void> {
  if (!patch || typeof patch !== "object") return;

  try {
    await gasPost({
      action: "telegramUpsertBookingsState",
      patch,
      webhookSecret: reviewWebhookSecret(),
    });
  } catch (err) {
    // Don't block Telegram messages if settings persistence fails.
    console.warn("[TG bookings] state upsert failed", err);
  }
}

