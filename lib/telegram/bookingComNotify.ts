import "server-only";

import { getBookingsTargets, isTelegramConfigured } from "./config";
import { escapeHtml, formatDateUk } from "./formatters";
import { sendTelegramMessage } from "./sendMessage";

export type BookingComSyncNotifyInput = {
  cottage: string;
  created: number;
  updated?: number;
  checkIn?: string;
  checkOut?: string;
};

export function buildBookingComSyncTelegramText(
  data: BookingComSyncNotifyInput
): string {
  const lines = [
    "🔵 <b>Нове бронювання Booking.com</b>",
    "",
    `🏡 <b>${escapeHtml(data.cottage || "—")}</b>`,
  ];
  if (data.checkIn && data.checkOut) {
    lines.push(
      `📅 ${formatDateUk(data.checkIn)} — ${formatDateUk(data.checkOut)}`
    );
  }
  if (data.created > 1) {
    lines.push(`➕ Нових блоків: <b>${data.created}</b>`);
  }
  lines.push("", "Джерело: iCal · Booking.com");
  return lines.join("\n");
}

export async function notifyBookingComSync(
  data: BookingComSyncNotifyInput
): Promise<boolean> {
  if (!isTelegramConfigured()) return false;
  if (data.created <= 0) return false;
  const target = getBookingsTargets();
  const res = await sendTelegramMessage(
    buildBookingComSyncTelegramText(data),
    undefined,
    target.chatId,
    target.threadId
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[TG] Booking.com sync notify failed", res.status, body);
    return false;
  }
  return true;
}
