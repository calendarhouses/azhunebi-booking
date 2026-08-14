import { listBookings } from "@/lib/db/bookings";
import { isPendingReviewStatus } from "@/lib/public-booking/bookingReview";
import { getRequestsTargets, isTelegramConfigured } from "./config";
import { sendTelegramMessage } from "./sendMessage";
import {
  buildPendingReviewKeyboard,
  type PendingReviewNotifyInput,
} from "./bookingReviewNotify";
import { escapeHtml, formatDateUk, formatPhoneDisplay } from "./formatters";

export type PendingReviewReminderResult = {
  ok: boolean;
  count: number;
  sent: boolean;
  orderIds: string[];
  error?: string;
};

function waitingLabel(createdAt?: string, id?: string): string | null {
  let start = Date.parse(String(createdAt || ""));
  if (!Number.isFinite(start) && id) {
    const m = String(id).match(/^[AB]-(\d{10,})$/);
    if (m) start = Number(m[1]);
  }
  if (!Number.isFinite(start) || start <= 0) return null;
  const mins = Math.max(0, Math.round((Date.now() - start) / 60_000));
  if (mins < 1) return "щойно";
  if (mins < 60) return `${mins} хв`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (hours < 24) return rest ? `${hours} год ${rest} хв` : `${hours} год`;
  const days = Math.floor(hours / 24);
  return `${days} д`;
}

function toNotifyInput(b: Record<string, unknown>): PendingReviewNotifyInput {
  return {
    orderId: String(b.id || "").trim(),
    name: String(b.name || ""),
    phone: String(b.phone || ""),
    cottage: String(b.cottage || ""),
    checkIn: String(b.checkIn || ""),
    checkOut: String(b.checkOut || ""),
    guests: Number(b.guests) || 0,
    totalPrice: Number(b.totalPrice) || 0,
    prepayAmount: Number(b.prepayAmount) || 0,
    comment: String(b.comment || ""),
    source: String(b.source || ""),
  };
}

function requestWord(n: number): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return "запит";
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return "запити";
  return "запитів";
}

export function buildPendingReviewReminderCaption(
  bookings: PendingReviewNotifyInput[],
  waitingById: Record<string, string | null>
): string {
  const n = bookings.length;
  const title =
    n === 1
      ? "🔔 <b>Нагадування: є запит на підтвердження</b>"
      : `🔔 <b>Нагадування: ${n} ${requestWord(n)} чекають підтвердження</b>`;

  const lines = [
    title,
    "",
    "Заявки досі без рішення. Підтвердіть або відхиліть нижче.",
    "",
  ];

  for (const b of bookings) {
    const wait = waitingById[b.orderId];
    const waitBit = wait ? ` · чекає ${wait}` : "";
    lines.push(
      `🏡 <b>${escapeHtml(b.cottage || "—")}</b>${waitBit}`,
      `👤 ${escapeHtml(b.name || "Гість")} (${formatPhoneDisplay(b.phone)})`,
      `📅 ${formatDateUk(b.checkIn)} — ${formatDateUk(b.checkOut)}`,
      `🔖 ${escapeHtml(b.orderId)}`,
      ""
    );
  }

  return lines.join("\n").trim();
}

export function buildPendingReviewReminderKeyboard(
  bookings: PendingReviewNotifyInput[]
) {
  const rows: { text: string; callback_data: string }[][] = [];
  for (const b of bookings.slice(0, 8)) {
    const kb = buildPendingReviewKeyboard(b).inline_keyboard[0];
    if (kb) rows.push(kb);
  }
  return { inline_keyboard: rows };
}

/** Ping the requests thread while any booking still awaits admin review. */
export async function sendPendingReviewReminders(): Promise<PendingReviewReminderResult> {
  const all = await listBookings();
  const pending = all.filter((b) => isPendingReviewStatus(String(b.status || "")));
  const orderIds = pending.map((b) => String(b.id || "")).filter(Boolean);

  if (!orderIds.length) {
    return { ok: true, count: 0, sent: false, orderIds: [] };
  }

  if (!isTelegramConfigured()) {
    return {
      ok: false,
      count: pending.length,
      sent: false,
      orderIds,
      error: "TELEGRAM_NOT_CONFIGURED",
    };
  }

  const inputs = pending.map((b) => toNotifyInput(b));
  const waitingById: Record<string, string | null> = {};
  for (const b of pending) {
    const id = String(b.id || "");
    waitingById[id] = waitingLabel(String(b.createdAt || ""), id);
  }

  const caption = buildPendingReviewReminderCaption(inputs, waitingById);
  const keyboard = buildPendingReviewReminderKeyboard(inputs);
  const target = getRequestsTargets();
  let res = await sendTelegramMessage(caption, keyboard, target.chatId, target.threadId);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[TG] pending review reminder failed:", res.status, body);
    res = await sendTelegramMessage(caption, undefined, target.chatId, target.threadId);
    if (!res.ok) {
      const body2 = await res.text().catch(() => "");
      return {
        ok: false,
        count: pending.length,
        sent: false,
        orderIds,
        error: body2 || `telegram ${res.status}`,
      };
    }
  }

  return { ok: true, count: pending.length, sent: true, orderIds };
}
