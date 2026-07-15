import {
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

export function buildGuestRejectedSmsText(booking: GuestMessengerBooking): string {
  const firstName = String(booking.name || "Гість").trim().split(/\s+/)[0] || "Гість";
  const dates = `${formatGuestDateShort(booking.checkIn)} — ${formatGuestDateShort(booking.checkOut)}`;
  const cottage = booking.cottage || "обраний будинок";

  return [
    `${firstName}, на жаль, бронь скасовано.`,
    `${cottage}, ${dates}.`,
    "Спробуйте забронювати інші дати на сайті.",
  ].join(" ");
}

export async function sendBookingRejectedSms(
  booking: GuestMessengerBooking
): Promise<TurboSmsSendResult> {
  const phone = normalizeGuestPhone(booking.phone);
  if (!phone) {
    return { ok: false, error: "missing phone" };
  }

  const text = buildGuestRejectedSmsText(booking);
  const orderId = String(booking.id || "").trim();
  return sendTurboSms({
    phone,
    text,
    sequenceId: orderId ? `reject-${orderId}` : undefined,
  });
}
