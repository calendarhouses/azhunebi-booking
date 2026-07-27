import {
  buildGuestPaymentUrl,
  normalizeGuestPhone,
  type GuestMessengerBooking,
} from "@/lib/admin/guestMessengerLinks";
import { sendTurboSms, type TurboSmsSendResult } from "./turbosms";
import { guestCottageLabel } from "./guestCottageLabel";

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

export function buildGuestApprovedSmsText(
  booking: GuestMessengerBooking,
  cottage?: string,
): string {
  const firstName = String(booking.name || "Гість").trim().split(/\s+/)[0] || "Гість";
  const dates = `${formatGuestDateShort(booking.checkIn)} — ${formatGuestDateShort(booking.checkOut)}`;
  const prepay = Math.round(Number(booking.prepayAmount) || 0);
  const orderId = String(booking.id || "").trim();
  const payUrl = orderId ? buildGuestPaymentUrl(orderId) : "";

  const lines = [
    `Вітаємо, ${firstName}! Заявку схвалено, дати зарезервовано для оплати на 3 години.`,
    `${cottage || booking.cottage || "Котедж"}, ${dates}.`,
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

  const text = buildGuestApprovedSmsText(booking, await guestCottageLabel(booking));
  const orderId = String(booking.id || "").trim();
  return sendTurboSms({
    phone,
    text,
    sequenceId: orderId ? `payment_link-${orderId}` : undefined,
  });
}
