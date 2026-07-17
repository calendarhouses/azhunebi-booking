import { NextResponse } from "next/server";
import { fetchBookingByDisplayId } from "@/lib/gas-api";
import { isAwaitingPaymentStatus } from "@/lib/public-booking/bookingReview";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("orderId")?.trim() || "";
  if (!orderId || orderId.length > 120) {
    return NextResponse.json(
      { ok: false, error: "INVALID_ORDER" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const result = await fetchBookingByDisplayId(orderId);
  if (!result.ok || !result.booking) {
    return NextResponse.json(
      { ok: false, error: "BOOKING_NOT_FOUND" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const status = String(result.booking.status || "");
  const paidAmount = Number(result.booking.paidAmount) || 0;
  return NextResponse.json(
    {
      ok: true,
      paid: status === "Підтверджено",
      awaiting: isAwaitingPaymentStatus(status),
      booking: {
        orderId,
        cottage: result.booking.cottage,
        checkIn: result.booking.checkIn,
        checkOut: result.booking.checkOut,
        guests: Number(result.booking.guests) || 0,
        totalPrice: result.booking.totalPrice,
        prepayment: paidAmount,
        paidAmount,
        flow: "instant" as const,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
