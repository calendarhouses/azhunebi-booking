import { NextResponse } from "next/server";
import { fetchBookingByDisplayId } from "@/lib/gas-api";
import { isMonoChastBooking } from "@/lib/monoparts/config";
import { settleMonoPartsOrder } from "@/lib/monoparts/settle";
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

  const booking = result.booking;
  const status = String(booking.status || "");
  if (status === "Підтверджено") {
    return NextResponse.json(
      { ok: true, paid: true, awaiting: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!isAwaitingPaymentStatus(status)) {
    return NextResponse.json(
      { ok: true, paid: false, awaiting: false, cancelled: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!isMonoChastBooking(booking) || !booking.monoInvoiceId) {
    return NextResponse.json(
      { ok: true, paid: false, awaiting: true, partsStarted: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const settled = await settleMonoPartsOrder({
    orderId,
    monoOrderId: booking.monoInvoiceId,
    booking,
  });

  if (!settled.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: settled.reason,
        message: settled.message,
      },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      paid: settled.settled,
      awaiting: !settled.settled && !settled.failed,
      waitingClient: Boolean(settled.waitingClient),
      failed: Boolean(settled.failed),
      message: settled.message,
      partsStarted: true,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
