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

export function buildBookingLifecycleSmsText(
  booking: GasBookingRecord,
  type: BookingLifecycleSmsType
): string {
  const orderId = String(booking.id || "").trim();

  if (type === "success") {
    return "Передоплату отримано. Бронювання підтверджено. АЖ У НЕБІ";
  }

  if (type === "expiry") {
    return "Резерв скасовано: передоплату не отримано. azhunebi.com";
  }

  const payUrl = orderId
    ? `${getPublicOrigin()}/pay/${encodeURIComponent(orderId)}`
    : getPublicOrigin();
  return `Оплата резерву (3 год): ${payUrl}`;
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
