import {
  confirmBookingPayment as gasConfirmBookingPayment,
  getBookingStatusByDisplayId as gasGetBookingStatusByDisplayId,
} from "@/lib/gas-api";

export type ConfirmBookingPaymentResult =
  | { ok: true; updated: boolean; bookingId: string; displayId: string }
  | {
      ok: false;
      reason: "not_found" | "amount_mismatch" | "db_error";
      message?: string;
    };

export async function confirmBookingPayment(
  orderReference: string,
  amountPaid: number,
  meta?: { provider?: string; transactionId?: string }
): Promise<ConfirmBookingPaymentResult> {
  const displayId = orderReference.trim();
  if (!displayId) return { ok: false, reason: "not_found" };

  const result = await gasConfirmBookingPayment(displayId, amountPaid, meta);
  if (!result.ok) {
    const reason =
      result.reason === "not_found"
        ? "not_found"
        : result.reason === "amount_mismatch"
          ? "amount_mismatch"
          : "db_error";
    console.error("[Payment] confirmBookingPayment failed", {
      displayId,
      reason,
      message: result.message,
    });
    return { ok: false, reason, message: result.message };
  }

  return {
    ok: true,
    updated: result.updated ?? false,
    bookingId: result.bookingId ?? displayId,
    displayId: result.displayId ?? displayId,
  };
}

export async function getBookingStatusByDisplayId(
  displayId: string
): Promise<string | null> {
  return gasGetBookingStatusByDisplayId(displayId);
}
