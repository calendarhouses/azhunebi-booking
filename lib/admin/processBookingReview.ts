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

  if (params.decision === "reject") {
    return { ok: true, orderId, decision: "reject" };
  }

  // Статус уже змінено в GAS — SMS/reload не повинні ламати успіх approve.
  let booking =
    result.booking || (await fetchBookingByDisplayId(orderId).catch(() => null))?.booking;

  if (!booking) {
    console.warn("[review] approve ok but booking payload missing", orderId);
    return {
      ok: true,
      orderId,
      decision: "approve",
      smsLine: "Підтверджено, але дані броні не підвантажились для SMS.",
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

  try {
    const notifyResult = await notifyGuestBookingApproved(guestBooking);
    return {
      ok: true,
      orderId,
      decision: "approve",
      smsLine: formatSmsStatusLine(notifyResult),
      booking: guestBooking,
    };
  } catch (err) {
    console.error("[review] SMS notify threw", err);
    return {
      ok: true,
      orderId,
      decision: "approve",
      smsLine: "Підтверджено, але SMS не вдалося надіслати.",
      booking: guestBooking,
    };
  }
}
