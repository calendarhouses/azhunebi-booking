import type { GuestMessengerBooking } from "@/lib/admin/guestMessengerLinks";
import { fetchBookingByDisplayId, reviewBookingDecision } from "@/lib/gas-api";
import {
  formatSmsStatusLine,
  notifyGuestBookingRejected,
} from "@/lib/sms/notifyGuestBookingApproved";
import { sendBookingLifecycleSms } from "@/lib/sms/bookingLifecycleSms";

export type BookingReviewDecision = "approve" | "reject";

export type ProcessBookingReviewResult = {
  ok: boolean;
  reason?: string;
  orderId: string;
  decision: BookingReviewDecision;
  smsLine?: string;
  booking?: GuestMessengerBooking;
};

function toGuestBooking(
  orderId: string,
  booking: {
    name?: string;
    phone?: string;
    cottage?: string;
    checkIn?: string;
    checkOut?: string;
    prepayAmount?: number;
    totalPrice?: number;
  }
): GuestMessengerBooking {
  return {
    id: orderId,
    name: booking.name,
    phone: booking.phone,
    cottage: booking.cottage,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    prepayAmount: booking.prepayAmount,
    totalPrice: booking.totalPrice,
  };
}

export async function processBookingReview(params: {
  orderId: string;
  decision: BookingReviewDecision;
  adminAuth?: { token: string; tenantId: string };
}): Promise<ProcessBookingReviewResult> {
  const orderId = params.orderId.trim();
  const result = params.adminAuth
    ? await reviewBookingDecision({
        orderId,
        decision: params.decision,
        authToken: params.adminAuth.token,
        tenantId: params.adminAuth.tenantId,
      })
    : await reviewBookingDecision({
        orderId,
        decision: params.decision,
      });

  if (!result.ok) {
    const reason =
      result.reason ||
      (result as { error?: string }).error ||
      "update_failed";
    return {
      ok: false,
      reason: String(reason).toLowerCase().includes("unauthorized")
        ? "unauthorized"
        : String(reason),
      orderId,
      decision: params.decision,
    };
  }

  // Статус уже змінено в GAS — SMS/reload не повинні ламати успіх.
  const bookingRaw =
    result.booking || (await fetchBookingByDisplayId(orderId).catch(() => null))?.booking;

  if (!bookingRaw) {
    console.warn("[review] ok but booking payload missing", orderId, params.decision);
    return {
      ok: true,
      orderId,
      decision: params.decision,
      smsLine:
        params.decision === "approve"
          ? "Підтверджено, але дані броні не підвантажились для SMS."
          : "Скасовано, але дані броні не підвантажились для SMS.",
    };
  }

  const guestBooking = toGuestBooking(orderId, bookingRaw);

  try {
    const notifyResult =
      params.decision === "approve"
        ? {
            sms: await sendBookingLifecycleSms(
              { ...bookingRaw, id: orderId },
              "payment_link"
            ),
            smsSkipped: false,
          }
        : await notifyGuestBookingRejected(guestBooking);
    return {
      ok: true,
      orderId,
      decision: params.decision,
      smsLine: formatSmsStatusLine(notifyResult, params.decision),
      booking: guestBooking,
    };
  } catch (err) {
    console.error("[review] SMS notify threw", err);
    return {
      ok: true,
      orderId,
      decision: params.decision,
      smsLine:
        params.decision === "approve"
          ? "Підтверджено, але SMS не вдалося надіслати."
          : "Скасовано, але SMS не вдалося надіслати.",
      booking: guestBooking,
    };
  }
}
