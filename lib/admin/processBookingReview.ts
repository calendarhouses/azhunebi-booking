import type { GuestMessengerBooking } from "@/lib/admin/guestMessengerLinks";
import { fetchBookingByDisplayId, reviewBookingDecision } from "@/lib/gas-api";
import {
  formatSmsStatusLine,
  notifyGuestBookingApproved,
} from "@/lib/sms/notifyGuestBookingApproved";

export type BookingReviewDecision = "approve" | "reject";

export type ProcessBookingReviewResult = {
  ok: boolean;
  reason?: string;
  orderId: string;
  decision: BookingReviewDecision;
  smsLine?: string;
  booking?: GuestMessengerBooking;
};

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
    return {
      ok: false,
      reason: result.reason,
      orderId,
      decision: params.decision,
    };
  }

  if (params.decision === "reject") {
    return { ok: true, orderId, decision: "reject" };
  }

  const booking =
    result.booking || (await fetchBookingByDisplayId(orderId).catch(() => null))?.booking;
  if (!booking) {
    return {
      ok: false,
      reason: "booking_load_failed",
      orderId,
      decision: "approve",
    };
  }

  const guestBooking: GuestMessengerBooking = {
    id: orderId,
    name: booking.name,
    phone: booking.phone,
    cottage: booking.cottage,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    prepayAmount: booking.prepayAmount,
    totalPrice: booking.totalPrice,
  };

  const notifyResult = await notifyGuestBookingApproved(guestBooking);
  return {
    ok: true,
    orderId,
    decision: "approve",
    smsLine: formatSmsStatusLine(notifyResult),
    booking: guestBooking,
  };
}
