import { processBookingReview } from "@/lib/admin/processBookingReview";
import { normalizeGuestPhone } from "@/lib/admin/guestMessengerLinks";
import { parseEarlyLateTimesFromComment } from "@/lib/admin/flexibleSchedule";
import { parsePendingServiceIdsFromComment } from "@/components/admin/desktop/settings/additionalServicesLogic";
import { isTelegramConfigured } from "./config";
import {
  answerTelegramCallback,
  editTelegramMessage,
  sendTelegramMessage,
} from "./sendMessage";

export type PendingReviewNotifyInput = {
  orderId: string;
  name?: string;
  phone?: string;
  cottage?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  totalPrice?: number;
  prepayAmount?: number;
  comment?: string;
  source?: string;
};

const UK_MONTHS = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

function formatDateUk(value?: string): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getDate()} ${UK_MONTHS[d.getMonth()]}`;
}

function formatPhoneDisplay(phone?: string): string {
  const digits = normalizeGuestPhone(phone);
  if (!digits) return "—";
  return `+${digits}`;
}

function formatMoneyUa(amount: number): string {
  return `${Math.round(amount).toLocaleString("uk-UA")} ₴`;
}

function buildDecisionSummaryHtml(
  decision: "approve" | "reject",
  booking: {
    name?: string;
    phone?: string;
    cottage?: string;
    checkIn?: string;
    checkOut?: string;
    totalPrice?: number;
    prepayAmount?: number;
  },
  smsLine?: string
): string {
  const title =
    decision === "approve" ? "✅ <b>Прийнято</b>" : "❌ <b>Скасовано</b>";
  const dates = `${formatDateUk(booking.checkIn)} — ${formatDateUk(booking.checkOut)}`;
  const total = Math.round(Number(booking.totalPrice) || 0);
  const prepay = Math.round(Number(booking.prepayAmount) || 0);
  const lines = [
    title,
    "",
    `🏡 <b>${booking.cottage || "—"}</b>`,
    `👤 ${booking.name || "Гість"} (${formatPhoneDisplay(booking.phone)})`,
    `📅 ${dates}`,
  ];
  if (total > 0) lines.push(`💰 Вартість: <b>${formatMoneyUa(total)}</b>`);
  if (prepay > 0) lines.push(`💳 Передплата: <b>${formatMoneyUa(prepay)}</b>`);
  if (smsLine) {
    lines.push("", `📱 ${smsLine}`);
  }
  return lines.join("\n");
}

function countNights(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn.includes("T") ? checkIn : `${checkIn}T12:00:00`);
  const b = new Date(checkOut.includes("T") ? checkOut : `${checkOut}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function buildReviewReasons(comment?: string, checkIn?: string, checkOut?: string): string[] {
  const reasons: string[] = [];
  if (countNights(checkIn, checkOut) === 1) reasons.push("1 ніч");
  const { earlyTime, lateTime } = parseEarlyLateTimesFromComment(comment || "");
  if (earlyTime && /🕒#early⏳:/.test(comment || "")) {
    reasons.push(`ранній заїзд з ${earlyTime}`);
  }
  if (lateTime && /🕒#late⏳:/.test(comment || "")) {
    reasons.push(`пізній виїзд до ${lateTime}`);
  }
  const pendingServices = parsePendingServiceIdsFromComment(comment || "");
  if (pendingServices.size > 0) reasons.push("послуги за запитом");
  if ((comment || "").includes("🇺🇦 УБД: Так")) reasons.push("УБД");
  return reasons;
}

export function buildPendingReviewCaption(data: PendingReviewNotifyInput): string {
  const dates = `${formatDateUk(data.checkIn)} — ${formatDateUk(data.checkOut)}`;
  const total = Math.round(Number(data.totalPrice) || 0);
  const prepay = Math.round(Number(data.prepayAmount) || 0);
  const reasons = buildReviewReasons(data.comment, data.checkIn, data.checkOut);
  const reasonLine = reasons.length ? reasons.join(", ") : "особливі умови";

  return (
    `⏳ <b>Заявка на підтвердження</b> | ${data.source || "Сайт"}\n\n` +
    `🏡 <b>${data.cottage || "—"}</b>\n` +
    `👤 ${data.name || "Гість"} (${formatPhoneDisplay(data.phone)})\n` +
    `📅 ${dates} · ${data.guests || 2} гостей\n` +
    `📋 Причина: <i>${reasonLine}</i>\n\n` +
    `💰 Вартість: <b>${formatMoneyUa(total)}</b>\n` +
    `💳 Передплата: <b>${formatMoneyUa(prepay)}</b>`
  );
}

export function buildPendingReviewKeyboard(data: PendingReviewNotifyInput) {
  const orderId = data.orderId.trim();
  return {
    inline_keyboard: [
      [
        { text: "✅ Прийняти", callback_data: `br:approve:${orderId}` },
        { text: "❌ Відхилити", callback_data: `br:reject:${orderId}` },
      ],
    ],
  };
}

export function buildPendingReviewCaptionWithHint(data: PendingReviewNotifyInput): string {
  return buildPendingReviewCaption(data);
}

export async function notifyPendingBookingReview(
  data: PendingReviewNotifyInput
): Promise<void> {
  if (!isTelegramConfigured()) {
    console.warn("[TG] Skipping pending review notify — TELEGRAM_BOT_TOKEN / CHAT_ID not set");
    return;
  }
  const caption = buildPendingReviewCaptionWithHint(data);
  const keyboard = buildPendingReviewKeyboard(data);
  let res = await sendTelegramMessage(caption, keyboard);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[TG] pending review notify failed:", res.status, body);
    // fallback без клавіатури — хоча б текст дійде
    res = await sendTelegramMessage(caption);
    if (!res.ok) {
      const body2 = await res.text().catch(() => "");
      console.error("[TG] pending review notify fallback failed:", res.status, body2);
    }
  }
}

export async function handleBookingReviewCallback(
  callbackData: string,
  callbackQueryId: string,
  chatId: number | string,
  messageId: number
): Promise<void> {
  const match = callbackData.match(/^br:(approve|reject):(.+)$/);
  if (!match) {
    await answerTelegramCallback(callbackQueryId, "Невідома дія");
    return;
  }

  const decision = match[1] as "approve" | "reject";
  const orderId = match[2].trim();

  const result = await processBookingReview({ orderId, decision });
  if (!result.ok) {
    const alert =
      result.reason === "not_found"
        ? "Бронь не знайдено"
        : result.reason === "unauthorized"
          ? "Немає доступу (секрет GAS). Звернись до розробника."
          : `Помилка: ${result.reason || "оновлення"}`;
    await answerTelegramCallback(callbackQueryId, alert);
    return;
  }

  if (decision === "reject") {
    const smsLine = result.smsLine || "Скасовано";
    await answerTelegramCallback(callbackQueryId, smsLine);
    const body = result.booking
      ? buildDecisionSummaryHtml("reject", result.booking, smsLine)
      : `❌ <b>Скасовано</b>\n\n📱 ${smsLine}`;
    await editTelegramMessage(chatId, messageId, body, {
      inline_keyboard: [],
    });
    return;
  }

  const smsLine = result.smsLine || "Готово";
  await answerTelegramCallback(callbackQueryId, smsLine);
  const body = result.booking
    ? buildDecisionSummaryHtml("approve", result.booking, smsLine)
    : `✅ <b>Прийнято</b>\n\n📱 ${smsLine}`;
  await editTelegramMessage(chatId, messageId, body, {
    inline_keyboard: [],
  });
}
