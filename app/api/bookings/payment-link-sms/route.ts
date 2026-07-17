import { NextResponse } from "next/server";
import { fetchBookingByDisplayId } from "@/lib/gas-api";
import { isAwaitingPaymentStatus } from "@/lib/public-booking/bookingReview";
import { sendBookingLifecycleSms } from "@/lib/sms/bookingLifecycleSms";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { orderId?: unknown };
  try {
    body = (await request.json()) as { orderId?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const orderId = String(body.orderId || "").trim();
  if (!orderId || orderId.length > 120) {
    return NextResponse.json({ ok: false, error: "INVALID_ORDER" }, { status: 400 });
  }

  const result = await fetchBookingByDisplayId(orderId);
  if (!result.ok || !result.booking) {
    return NextResponse.json({ ok: false, error: "BOOKING_NOT_FOUND" }, { status: 404 });
  }
  if (
    result.booking.source !== "Сайт" ||
    !isAwaitingPaymentStatus(result.booking.status)
  ) {
    return NextResponse.json({ ok: false, error: "NOT_AWAITING_PAYMENT" }, { status: 409 });
  }

  const sms = await sendBookingLifecycleSms(result.booking, "payment_link");
  if (!sms.ok) {
    console.error("[Payment link SMS] Send failed", {
      orderId,
      error: sms.error || sms.responseStatus,
    });
    return NextResponse.json(
      { ok: false, error: sms.error || sms.responseStatus || "SMS_FAILED" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
