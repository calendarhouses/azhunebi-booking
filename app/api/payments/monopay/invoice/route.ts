import { NextResponse } from "next/server";
import { fetchBookingByDisplayId } from "@/lib/gas-api";
import { createMonoInvoice, MonoApiError } from "@/lib/monopay/client";
import { getPublicOrigin } from "@/lib/monopay/config";
import { isAwaitingPaymentStatus } from "@/lib/public-booking/bookingReview";

export const runtime = "nodejs";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { ok: false, code, message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

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

  const amountUah = Math.round(Number(booking.prepayAmount) || 0);
  if (!Number.isSafeInteger(amountUah) || amountUah <= 0) {
    return errorResponse(409, "INVALID_AMOUNT", "Для бронювання не визначено передплату");
  }

  const publicOrigin = getPublicOrigin();
  const encodedOrderId = encodeURIComponent(orderId);

  try {
    const invoice = await createMonoInvoice({
      reference: orderId,
      amountUah,
      destination: `Передплата за ${booking.cottage || "бронювання"}`,
      redirectUrl: `${publicOrigin}/pay/${encodedOrderId}?payment=return`,
      webHookUrl: `${publicOrigin}/api/webhooks/monopay`,
    });

    return NextResponse.json(
      {
        ok: true,
        invoiceId: invoice.invoiceId,
        pageUrl: invoice.pageUrl,
        amount: amountUah,
        reference: orderId,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[MonoPay] Invoice creation failed", {
      orderId,
      status: error instanceof MonoApiError ? error.status : undefined,
      code: error instanceof MonoApiError ? error.code : undefined,
      message: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof MonoApiError && error.status === 403) {
      return errorResponse(503, "MONO_AUTH_FAILED", "MonoPay відхилив токен мерчанта");
    }
    return errorResponse(502, "MONO_UNAVAILABLE", "Не вдалося відкрити оплату MonoPay");
  }
}
