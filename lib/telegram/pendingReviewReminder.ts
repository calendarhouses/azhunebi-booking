import { listBookings } from "@/lib/db/bookings";
import { isPendingReviewStatus } from "@/lib/public-booking/bookingReview";
import { getRequestsTargets, isTelegramConfigured } from "./config";
import { sendTelegramMessage } from "./sendMessage";

export type PendingReviewReminderResult = {
  ok: boolean;
  count: number;
  sent: boolean;
  orderIds: string[];
  error?: string;
};

function requestWord(n: number): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return "запит";
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return "запити";
  return "запитів";
}

export function buildPendingReviewReminderCaption(count: number): string {
  const n = Math.max(1, Math.round(count));
  const verb = n === 1 ? "чекає" : "чекають";
  return `🔔 Нагадування: ${n} ${requestWord(n)} ${verb} підтвердження`;
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

  const caption = buildPendingReviewReminderCaption(pending.length);
  const target = getRequestsTargets();
  const res = await sendTelegramMessage(caption, undefined, target.chatId, target.threadId);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[TG] pending review reminder failed:", res.status, body);
    return {
      ok: false,
      count: pending.length,
      sent: false,
      orderIds,
      error: body || `telegram ${res.status}`,
    };
  }

  return { ok: true, count: pending.length, sent: true, orderIds };
}
