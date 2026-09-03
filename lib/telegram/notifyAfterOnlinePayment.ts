import "server-only";

import type { GasBookingRecord } from "@/lib/gas-api-server";
import { markPaidBookingTelegramSent } from "@/lib/gas-api-server";
import { notifyPaidBookingOnce } from "./paidBookingNotify";
import { notifyPaymentReceived, type PaymentReceivedKind } from "./paymentReceivedNotify";

function isSiteBooking(source?: string | null): boolean {
  return String(source || "").trim() === "Сайт";
}

/**
 * After MonoPay / Parts settles:
 * - Site booking: unchanged — «Нове оплачене бронювання» in БРОНЮВАННЯ.
 * - Admin 0/0 pay-link only: finance thread (booking already announced).
 */
export async function notifyAfterOnlinePayment(opts: {
  booking: GasBookingRecord;
  amount: number;
  kind: PaymentReceivedKind;
  method?: string;
}): Promise<"sent" | "already" | "failed" | "skipped"> {
  const booking = opts.booking;
  if (isSiteBooking(booking.source)) {
    return notifyPaidBookingOnce(booking);
  }

  // Only the admin 0/0 pay-link flow (SMS claimed payment_link).
  if (!String(booking.paymentLinkSmsSentAt || "").trim()) {
    return "skipped";
  }

  if (booking.paidTelegramSentAt) return "already";
  const orderId = String(booking.id || "").trim();
  if (!orderId) return "failed";

  const claim = await markPaidBookingTelegramSent(orderId);
  if (!claim.ok) return "failed";
  if (claim.already || claim.claimed === false) return "already";

  const sent = await notifyPaymentReceived({
    name: booking.name,
    phone: booking.phone,
    cottage: booking.cottage,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    totalPrice: Number(booking.totalPrice) || 0,
    paidAmount: Number(booking.paidAmount) || 0,
    amount: opts.amount,
    method: opts.method || "MonoPay",
    bookingId: orderId,
    kind: opts.kind,
  });
  return sent ? "sent" : "failed";
}
