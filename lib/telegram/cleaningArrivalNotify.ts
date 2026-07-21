import { parseChildrenFromComment } from "@/components/admin/desktop/settings/additionalServicesLogic";
import {
  getCleaningTargets,
  isCleaningConfigured,
  isTelegramConfigured,
} from "./config";
import { escapeHtml, isConfirmedBookingStatus, toDateKeyKyiv, todayKeyKyiv } from "./formatters";
import { sendTelegramMessage } from "./sendMessage";
import type { ArrivalDepartureBooking } from "./arrivalDepartureNotify";

function formatCleaningGuestsLabel(adults: number, children: number): string {
  const a = Math.max(0, Math.round(Number(adults) || 0));
  const c = Math.max(0, Math.round(Number(children) || 0));
  const parts: string[] = [];
  if (a > 0) parts.push(`${a} ${a === 1 ? "дорослий" : "дорослих"}`);
  if (c > 0) parts.push(`${c} ${c === 1 ? "дитина" : "дітей"}`);
  return parts.join(" + ") || "—";
}

export function buildCleaningArrivalCaption(booking: ArrivalDepartureBooking): string {
  const adults = Number(booking.guests) || 0;
  const children = parseChildrenFromComment(booking.comment || "");
  const guestsLabel = formatCleaningGuestsLabel(adults, children);

  return [
    `🛎 <b>СЬОГОДНІ ЗАЇЗД | ${escapeHtml(booking.cottage || "Котедж")}</b>`,
    "",
    "<b>ДЕТАЛІ:</b>",
    `👥 ${escapeHtml(guestsLabel)}`,
  ].join("\n");
}

export async function notifyCleaningTodayArrivals(
  bookings: ArrivalDepartureBooking[]
): Promise<number> {
  if (!isTelegramConfigured() || !isCleaningConfigured()) {
    console.warn("[TG] Skipping cleaning arrival notify — Telegram or cleaning chat not configured");
    return 0;
  }

  const today = todayKeyKyiv();
  const target = getCleaningTargets();
  let sent = 0;

  for (const booking of bookings) {
    if (!isConfirmedBookingStatus(booking.status)) continue;
    if (toDateKeyKyiv(booking.checkIn) !== today) continue;

    const res = await sendTelegramMessage(
      buildCleaningArrivalCaption(booking),
      undefined,
      target.chatId,
      target.threadId
    );
    if (res.ok) sent += 1;
    else console.error("[TG] cleaning arrival notify failed", await res.text().catch(() => ""));
  }

  return sent;
}
