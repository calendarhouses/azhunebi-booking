import {
  confirmBookingPayment as serverConfirmBookingPayment,
  getBookingStatusByDisplayId as serverGetBookingStatusByDisplayId,
} from "@/lib/gas-api-server";

export async function confirmBookingPayment(
  orderReference: string,
  amountPaid: number
) {
  const result = await serverConfirmBookingPayment(orderReference, amountPaid, {
    provider: "wayforpay",
  });
  if (!result.ok) {
    console.error("[WayForPay] confirmBookingPayment:", result.message);
  }
  return result;
}

export async function getBookingStatusByDisplayId(displayId: string): Promise<string | null> {
  return serverGetBookingStatusByDisplayId(displayId);
}
