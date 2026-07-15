import {
  buildGuestPaymentUrl,
  normalizeGuestPhone,
  type GuestMessengerBooking,
} from "@/lib/admin/guestMessengerLinks";
import { sendTurboSms, type TurboSmsSendResult } from "./turbosms";

const UK_MONTHS = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

function formatGuestDateShort(value?: string): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getDate()} ${UK_MONTHS[d.getMonth()]}`;
}

export function buildGuestApprovedSmsText(booking: GuestMessengerBooking): string {
  const firstName = String(booking.name || "Гість").trim().split(/\s+/)[0] || "Гість";
  const dates = `${formatGuestDateShort(booking.checkIn)} — ${formatGuestDateShort(booking.checkOut)}`;
  const prepay = Math.round(Number(booking.prepayAmount) || 0);
  const orderId = String(booking.id || "").trim();
  const payUrl = orderId ? buildGuestPaymentUrl(orderId) : "";

  const lines = [
    `Вітаємо, ${firstName}! Бронь підтверджено.`,
    `${booking.cottage || "Котедж"}, ${dates}.`,
  ];

  if (prepay > 0) {
    lines.push(`До оплати: ${prepay.toLocaleString("uk-UA")} грн.`);
  }

  if (payUrl) {
    lines.push(`Оплатити: ${payUrl}`);
  }

  return lines.join(" ");
}

export async function sendBookingApprovedSms(
  booking: GuestMessengerBooking
): Promise<TurboSmsSendResult> {
  const phone = normalizeGuestPhone(booking.phone);
  if (!phone) {
    return { ok: false, error: "missing phone" };
  }

  const text = buildGuestApprovedSmsText(booking);
  const orderId = String(booking.id || "").trim();
  return sendTurboSms({
    phone,
    text,
    sequenceId: orderId ? `approve-${orderId}` : undefined,
  });
}
