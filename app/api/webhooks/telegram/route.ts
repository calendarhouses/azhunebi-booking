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

export async function POST(request: Request) {
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
