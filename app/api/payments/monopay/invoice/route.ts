import { NextResponse } from "next/server";
import { fetchBookingByDisplayId, storeMonoInvoice } from "@/lib/gas-api";
import { createMonoInvoice, MonoApiError } from "@/lib/monopay/client";
import {
  getMonoTestAmountUah,
  getPublicOrigin,
  resolveMonoChargeAmountUah,
} from "@/lib/monopay/config";
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

  const deadlineMs = booking.paymentExpiresAt
    ? new Date(booking.paymentExpiresAt).getTime()
    : Date.now() + 3 * 60 * 60 * 1000;
  const validitySeconds = Math.floor((deadlineMs - Date.now()) / 1000);
  if (!Number.isFinite(validitySeconds) || validitySeconds < 60) {
    return errorResponse(409, "PAYMENT_EXPIRED", "Час резерву для оплати завершився");
  }

  if (booking.monoInvoiceId && booking.monoPageUrl) {
    return NextResponse.json(
      {
        ok: true,
        invoiceId: booking.monoInvoiceId,
        pageUrl: booking.monoPageUrl,
        amount: resolveMonoChargeAmountUah(Math.round(Number(booking.prepayAmount) || 0)),
        testMode: getMonoTestAmountUah() != null,
        reference: orderId,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const amountUah = Math.round(Number(booking.prepayAmount) || 0);
  if (!Number.isSafeInteger(amountUah) || amountUah <= 0) {
    return errorResponse(409, "INVALID_AMOUNT", "Для бронювання не визначено передплату");
  }

  const publicOrigin = getPublicOrigin();
  const testAmountUah = getMonoTestAmountUah();
  const chargeAmountUah = resolveMonoChargeAmountUah(amountUah);

  try {
    const invoice = await createMonoInvoice({
      reference: orderId,
      amountUah: chargeAmountUah,
      destination: `${testAmountUah ? "Тестова оплата за" : "Передплата за"} ${
        booking.cottage || "бронювання"
      }`,
      redirectUrl: `${publicOrigin}/?payment=return&orderId=${encodeURIComponent(orderId)}`,
      webHookUrl: `${publicOrigin}/api/webhooks/monopay`,
      validitySeconds,
    });
    const stored = await storeMonoInvoice({
      orderId,
      invoiceId: invoice.invoiceId,
      pageUrl: invoice.pageUrl,
    });
    if (!stored.ok) {
      return errorResponse(409, "INVOICE_NOT_STORED", "Не вдалося закріпити рахунок за бронюванням");
    }
    const activeInvoiceId = stored.booking?.monoInvoiceId || invoice.invoiceId;
    const activePageUrl = stored.booking?.monoPageUrl || invoice.pageUrl;

    return NextResponse.json(
      {
        ok: true,
        invoiceId: activeInvoiceId,
        pageUrl: activePageUrl,
        amount: chargeAmountUah,
        testMode: testAmountUah != null,
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
