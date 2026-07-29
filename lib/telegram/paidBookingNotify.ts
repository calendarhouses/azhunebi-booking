import "server-only";

import {
  markPaidBookingTelegramSent,
  type GasBookingRecord,
} from "@/lib/gas-api";
import { normalizeGuestPhone } from "@/lib/admin/guestMessengerLinks";
import { parseEarlyLateTimesFromComment } from "@/lib/admin/flexibleSchedule";
import { parseChildrenFromComment, parseYoungestChildAgeFromComment } from "@/components/admin/desktop/settings/additionalServicesLogic";
import { formatGuestsLabel } from "@/lib/public-booking/formatGuestsLabel";
import { getBookingsTargets, isTelegramConfigured } from "./config";
import { upsertTelegramBookingsState } from "./bookingsState";
import { sendTelegramMessage } from "./sendMessage";

const UK_MONTHS = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? escapeHtml(value)
    : `${date.getDate()} ${UK_MONTHS[date.getMonth()]}`;
}

function countNights(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn.includes("T") ? checkIn : `${checkIn}T12:00:00`);
  const end = new Date(checkOut.includes("T") ? checkOut : `${checkOut}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function nightWord(value: number): string {
  const n = Math.abs(value) % 100;
  const last = n % 10;
  if (n >= 11 && n <= 14) return "ночей";
  if (last === 1) return "ніч";
  if (last >= 2 && last <= 4) return "ночі";
  return "ночей";
}

function money(value?: number): string {
  return `${Math.round(Number(value) || 0).toLocaleString("uk-UA")} ₴`;
}

function guestComment(raw?: string): string {
  const comment = String(raw || "");
  const marker = "Коментар гостя:";
  const index = comment.indexOf(marker);
  return index >= 0 ? comment.slice(index + marker.length).trim() : "";
}

export function buildPaidBookingTelegramText(booking: GasBookingRecord): string {
  const phone = normalizeGuestPhone(booking.phone);
  const nights = countNights(booking.checkIn, booking.checkOut);
  const paid = Number(booking.paidAmount) || 0;
  const total = Number(booking.totalPrice) || 0;
  const balance = Math.max(0, total - paid);
  const { earlyTime, lateTime } = parseEarlyLateTimesFromComment(booking.comment || "");
  const comment = guestComment(booking.comment);
  const guestsLabel = formatGuestsLabel(
    Number(booking.guests) || 0,
    parseChildrenFromComment(booking.comment || ""),
    parseYoungestChildAgeFromComment(booking.comment || "")
  );
  const lines = [
    "✅ <b>Нове оплачене бронювання</b> | Сайт",
    "",
    `🏡 <b>${escapeHtml(booking.cottage || "—")}</b>`,
    `📅 ${formatDate(booking.checkIn)} — ${formatDate(booking.checkOut)} · ${nights} ${nightWord(nights)}`,
    `👤 ${escapeHtml(booking.name || "Гість")}`,
    `📞 ${phone ? `+${phone}` : "—"}`,
    `👥 Гості: <b>${escapeHtml(guestsLabel)}</b>`,
  ];
  if (booking.pets === "Так") lines.push("🐾 З тваринами");
  if (earlyTime) lines.push(`🕒 Ранній заїзд: ${escapeHtml(earlyTime)}`);
  if (lateTime) lines.push(`🕒 Пізній виїзд: ${escapeHtml(lateTime)}`);
  if (comment) lines.push(`💬 ${escapeHtml(comment)}`);
  lines.push("", `💰 Загальна вартість: <b>${money(total)}</b>`);
  if (balance <= 0 && paid > 0) {
    lines.push(`✅ Оплачено повністю: <b>${money(paid)}</b>`);
  } else {
    lines.push(
      `💳 Передоплата: <b>${money(paid)}</b>`,
      `🧾 Залишок: <b>${money(balance)}</b>`
    );
  }
  lines.push(`🔖 ${escapeHtml(booking.id || "")}`);
  return lines.join("\n");
}

export async function notifyPaidBooking(booking: GasBookingRecord): Promise<boolean> {
  if (!isTelegramConfigured()) {
    console.warn("[TG] Skipping paid booking notify — Telegram is not configured");
    return false;
  }
  const target = getBookingsTargets();
  const response = await sendTelegramMessage(
    buildPaidBookingTelegramText(booking),
    undefined,
    target.chatId,
    target.threadId
  );

  if (response.ok) {
    // Persist `message_id/chat_id` so we can edit this booking message later.
    try {
      const json = await response.json().catch(() => null);
      const messageId = json?.result?.message_id;
      const chatId = json?.result?.chat?.id ?? target.chatId;
      const bookingId = String(booking.id || "").trim();
      if (
        bookingId &&
        typeof messageId === "number" &&
        (typeof chatId === "string" || typeof chatId === "number")
      ) {
        await upsertTelegramBookingsState({
          [bookingId]: { chatId, messageId },
        });
      }
    } catch (err) {
      console.warn("[TG paid booking] Failed to persist message state", err);
    }
    return true;
  }
  const body = await response.text().catch(() => "");
  console.error("[TG] Paid booking notify failed", response.status, body);
  return false;
}

/** Claim GAS marker first, then send — prevents webhook + cron duplicates. */
export async function notifyPaidBookingOnce(
  booking: GasBookingRecord
): Promise<"sent" | "already" | "failed" | "skipped"> {
  if (booking.paidTelegramSentAt) return "already";
  const orderId = String(booking.id || "").trim();
  if (!orderId) return "failed";
  if (!isTelegramConfigured()) {
    console.warn("[TG] Skipping paid booking notify — Telegram is not configured");
    return "skipped";
  }

  const claim = await markPaidBookingTelegramSent(orderId);
  if (!claim.ok) return "failed";
  if (claim.already || claim.claimed === false) return "already";

  const sent = await notifyPaidBooking(booking);
  if (!sent) {
    console.error("[TG] Paid notify failed after claim (won't auto-retry)", { orderId });
    return "failed";
  }
  return "sent";
}
