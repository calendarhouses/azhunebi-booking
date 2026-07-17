import {
  confirmBookingPayment as gasConfirmBookingPayment,
  getBookingStatusByDisplayId as gasGetBookingStatusByDisplayId,
} from "@/lib/gas-api";

export type ConfirmBookingPaymentResult =
  | { ok: true; updated: boolean; bookingId: string; displayId: string }
  | { ok: false; reason: "not_found" | "db_error"; message?: string };

/**
 * Marks a site booking as paid after WayForPay Approved callback.
 * `orderReference` matches `bookings.display_id` (e.g. B-1739…).
 */
export async function confirmBookingPayment(
  orderReference: string,
  amountPaid: number
): Promise<ConfirmBookingPaymentResult> {
  const displayId = orderReference.trim();
  if (!displayId) {
    return { ok: false, reason: "not_found" };
  }

  const result = await gasConfirmBookingPayment(displayId, amountPaid, {
    provider: "WayForPay",
  });

  if (!result.ok) {
    if (result.reason === "not_found") {
      console.warn("[WayForPay] Booking not found for orderReference:", displayId);
      return { ok: false, reason: "not_found" };
    }
    console.error("[WayForPay] confirmBookingPayment:", result.message);
    return { ok: false, reason: "db_error", message: result.message };
  }

  if (result.updated) {
    console.log(
      `[WayForPay] Booking ${displayId} → Підтверджено, paidAmount=${amountPaid}`
    );
  } else {
    console.log("[WayForPay] Booking already confirmed (idempotent):", displayId);
  }

  return {
    ok: true,
    updated: result.updated ?? false,
    bookingId: result.bookingId ?? displayId,
    displayId: result.displayId ?? displayId,
  };
}

/** Poll helper for public ?payment=success flow. */
export async function getBookingStatusByDisplayId(
  displayId: string
): Promise<string | null> {
  return gasGetBookingStatusByDisplayId(displayId);
}
