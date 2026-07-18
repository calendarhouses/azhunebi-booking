import { NextResponse } from "next/server";
import { handleBookingReviewCallback } from "@/lib/telegram/bookingReviewNotify";

export const runtime = "nodejs";

type TelegramUpdate = {
  callback_query?: {
    id: string;
    data?: string;
    message?: {
      message_id: number;
      chat: { id: number | string };
    };
  };
};

/**
 * When TELEGRAM_WEBHOOK_SECRET is set, require matching
 * X-Telegram-Bot-Api-Secret-Token (set via scripts/set-telegram-webhook.mjs).
 * If unset, keep accepting updates so existing deploys do not break — log a warning.
 */
function isTelegramWebhookAuthorized(request: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!expected) {
    if (process.env.VERCEL_ENV === "production") {
      console.warn(
        "[TG webhook] TELEGRAM_WEBHOOK_SECRET is not set — webhook accepts all POSTs"
      );
    }
    return true;
  }
  const got = request.headers.get("x-telegram-bot-api-secret-token") || "";
  return got === expected;
}

export async function POST(request: Request) {
  if (!isTelegramWebhookAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const cq = update.callback_query;
  if (!cq?.data?.startsWith("br:") || !cq.message) {
    return NextResponse.json({ ok: true });
  }

  // Ignore demo keyboard from testTelegramAllBranches
  if (cq.data.startsWith("br:demo:")) {
    return NextResponse.json({ ok: true });
  }

  try {
    await handleBookingReviewCallback(
      cq.data,
      cq.id,
      cq.message.chat.id,
      cq.message.message_id
    );
  } catch (err) {
    console.error("[Telegram Webhook]", err);
  }

  return NextResponse.json({ ok: true });
}
