import "server-only";

import {
  markBookingSmsSent,
  type GasBookingRecord,
} from "@/lib/gas-api";
import {
  normalizeGuestPhone,
} from "@/lib/admin/guestMessengerLinks";
import { getPublicOrigin } from "@/lib/monopay/config";
import { isTurboSmsConfigured } from "./config";
import { sendTurboSms, type TurboSmsSendResult } from "./turbosms";

export type BookingLifecycleSmsType = "payment_link" | "success" | "expiry";

const UK_MONTHS = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : `${date.getDate()} ${UK_MONTHS[date.getMonth()]}`;
}

function formatDeadline(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("uk-UA", {
    timeZone: "Europe/Kyiv",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildBookingLifecycleSmsText(
  booking: GasBookingRecord,
  type: BookingLifecycleSmsType
): string {
  const firstName = String(booking.name || "Гість").trim().split(/\s+/)[0] || "Гість";
  const cottage = booking.cottage || "будиночок";
  const dates = `${formatDate(booking.checkIn)} — ${formatDate(booking.checkOut)}`;
  const orderId = String(booking.id || "").trim();

  if (type === "success") {
    return `Дякуємо, ${firstName}! Передоплату отримано. Бронювання ${cottage} на ${dates} підтверджено. Номер бронювання: ${orderId}. Чекаємо на вас в АЖ У НЕБІ!`;
  }

  if (type === "expiry") {
    return `На жаль, ${firstName}, ми не отримали передоплату за ${cottage} протягом 3 годин. Резерв скасовано, а дати знову доступні. Спробуйте забронювати ще раз: https://azhunebi.com`;
  }

  const prepay = Math.round(Number(booking.prepayAmount) || 0);
  const deadline = formatDeadline(booking.paymentExpiresAt);
  const payUrl = orderId
    ? `${getPublicOrigin()}/pay/${encodeURIComponent(orderId)}`
    : getPublicOrigin();
  return `Вітаємо, ${firstName}! Ми зарезервували ${cottage} на ${dates} на 3 години${
    deadline ? `, до ${deadline}` : ""
  }. Передоплата: ${prepay.toLocaleString("uk-UA")} грн. Оплатити: ${payUrl}`;
}

export async function sendBookingLifecycleSms(
  booking: GasBookingRecord,
  type: BookingLifecycleSmsType
): Promise<TurboSmsSendResult> {
  const alreadySent =
    (type === "payment_link" && booking.paymentLinkSmsSentAt) ||
    (type === "success" && booking.successSmsSentAt) ||
    (type === "expiry" && booking.expirySmsSentAt);
  if (alreadySent) return { ok: true, responseStatus: "already sent" };
  if (!isTurboSmsConfigured()) {
    return { ok: false, error: "TURBOSMS_TOKEN not configured" };
  }

  const phone = normalizeGuestPhone(booking.phone);
  if (!phone) return { ok: false, error: "missing phone" };

  const orderId = String(booking.id || "").trim();
  const result = await sendTurboSms({
    phone,
    text: buildBookingLifecycleSmsText(booking, type),
    sequenceId: orderId ? `${type}-${orderId}` : undefined,
  });
  if (result.ok && orderId) {
    const marked = await markBookingSmsSent(orderId, type);
    if (!marked.ok) {
      console.error("[SMS] Sent but marker update failed", { orderId, type, marked });
    }
  }
  return result;
}
