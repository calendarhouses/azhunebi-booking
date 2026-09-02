import { NextResponse } from "next/server";
import { clearMonoPaymentAttempt, fetchBookingByDisplayId } from "@/lib/gas-api-server";
import { isMonoChastBooking } from "@/lib/monoparts/config";
import { isAwaitingPaymentStatus } from "@/lib/public-booking/bookingReview";

export const runtime = "nodejs";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { ok: false, code, message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

/** Guest abandons in-progress ПЧ and returns to payment method choice. */
export async function POST(request: Request) {
  let body: { orderId?: unknown };
  try {
    body = (await request.json()) as { orderId?: unknown };
  } catch {
    return errorResponse(400, "INVALID_BODY", "Некоректний запит");
  }

  const orderId = String(body.orderId || "").trim();
  if (!orderId || orderId.length > 120) {
    return errorResponse(400, "INVALID_ORDER", "Некоректний номер бронювання");
  }

  const result = await fetchBookingByDisplayId(orderId);
  if (!result.ok || !result.booking) {
    return errorResponse(404, "BOOKING_NOT_FOUND", "Бронювання не знайдено");
  }

  const booking = result.booking;
  if (!isAwaitingPaymentStatus(booking.status)) {
    return errorResponse(409, "NOT_PAYABLE", "Це бронювання вже не очікує оплату");
  }

  if (!isMonoChastBooking(booking)) {
    return NextResponse.json(
      { ok: true, cleared: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const cleared = await clearMonoPaymentAttempt(orderId);
  if (!cleared.ok) {
    return errorResponse(502, "CLEAR_FAILED", "Не вдалося скинути заявку ПЧ");
  }

  return NextResponse.json(
    { ok: true, cleared: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
