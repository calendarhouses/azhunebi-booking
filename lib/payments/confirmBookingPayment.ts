import {
  confirmBookingPayment as serverConfirmBookingPayment,
  getBookingStatusByDisplayId as serverGetBookingStatusByDisplayId,
} from "@/lib/gas-api-server";

export async function confirmBookingPayment(
  orderReference: string,
  amountPaid: number,
  meta?: { provider?: string; transactionId?: string; testMode?: boolean }
) {
  const result = await serverConfirmBookingPayment(orderReference, amountPaid, meta);
  if (!result.ok) {
    console.error("[Payment] confirmBookingPayment failed", {
      orderReference,
      reason: result.reason,
      message: result.message,
    });
  }
  return result;
}

export async function getBookingStatusByDisplayId(displayId: string): Promise<string | null> {
  return serverGetBookingStatusByDisplayId(displayId);
}
