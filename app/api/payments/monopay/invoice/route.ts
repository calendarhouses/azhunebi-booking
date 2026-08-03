import { NextResponse } from "next/server";
import {
  clearMonoPaymentAttempt,
  fetchBookingByDisplayId,
  storeMonoInvoice,
} from "@/lib/gas-api";
import { createMonoInvoice, getMonoInvoiceStatus, MonoApiError } from "@/lib/monopay/client";
import {
  getMonoTestAmountUah,
  getPublicOrigin,
  resolveMonoChargeAmountUah,
} from "@/lib/monopay/config";
import { getMonoChastOrderState } from "@/lib/monoparts/client";
import { isMonoChastBooking } from "@/lib/monoparts/config";
import { isAwaitingPaymentStatus } from "@/lib/public-booking/bookingReview";
import { isPublicOnlinePaymentEnabled } from "@/lib/public-booking/onlinePayment";

export const runtime = "nodejs";

type AmountKind = "prepay" | "full";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { ok: false, code, message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

function parseAmountKind(raw: unknown): AmountKind {
  return String(raw || "").trim().toLowerCase() === "full" ? "full" : "prepay";
}

function chargeBaseUah(
  booking: { prepayAmount?: number; totalPrice?: number },
  kind: AmountKind
): number {
  return kind === "full"
    ? Math.round(Number(booking.totalPrice) || 0)
    : Math.round(Number(booking.prepayAmount) || 0);
}

export async function POST(request: Request) {
  if (!isPublicOnlinePaymentEnabled()) {
    return errorResponse(
      503,
      "PAYMENT_DISABLED",
      "Онлайн-оплата тимчасово недоступна. Очікуйте підтвердження адміністратором."
    );
  }

  let body: { orderId?: unknown; amountKind?: unknown };
  try {
    body = (await request.json()) as { orderId?: unknown; amountKind?: unknown };
  } catch {
    return errorResponse(400, "INVALID_BODY", "Некоректний запит");
  }

  const orderId = String(body.orderId || "").trim();
  const amountKind = parseAmountKind(body.amountKind);
  if (!orderId || orderId.length > 120) {
    return errorResponse(400, "INVALID_ORDER", "Некоректний номер бронювання");
  }

  let result = await fetchBookingByDisplayId(orderId);
  if (!result.ok || !result.booking) {
    return errorResponse(404, "BOOKING_NOT_FOUND", "Бронювання не знайдено");
  }

  let booking = result.booking;
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

  let forceReplace = false;

  if (isMonoChastBooking(booking) && booking.monoInvoiceId) {
    try {
      const state = await getMonoChastOrderState(booking.monoInvoiceId);
      const top = String(state.state || "").toUpperCase();
      if (top === "FAIL") {
        await clearMonoPaymentAttempt(orderId);
        forceReplace = true;
        result = await fetchBookingByDisplayId(orderId);
        if (result.ok && result.booking) booking = result.booking;
      } else if (top === "SUCCESS") {
        return errorResponse(409, "ALREADY_PAID", "Оплату вже підтверджено");
      } else {
        return errorResponse(
          409,
          "PARTS_STARTED",
          "Заявку Покупки частинами ще обробляє Monobank. Зачекайте або підтвердіть у застосунку — після відмови можна обрати інший спосіб."
        );
      }
    } catch {
      // If Mono Parts status is unavailable, unlock guest to pay via acquiring.
      await clearMonoPaymentAttempt(orderId);
      forceReplace = true;
      result = await fetchBookingByDisplayId(orderId);
      if (result.ok && result.booking) booking = result.booking;
    }
  }

  const amountUah = chargeBaseUah(booking, amountKind);
  if (!Number.isSafeInteger(amountUah) || amountUah <= 0) {
    return errorResponse(
      409,
      "INVALID_AMOUNT",
      amountKind === "full"
        ? "Некоректна повна сума бронювання"
        : "Для бронювання не визначено передплату"
    );
  }

  const publicOrigin = getPublicOrigin();
  const testAmountUah = getMonoTestAmountUah();
  const chargeAmountUah = resolveMonoChargeAmountUah(amountUah);

  if (
    !forceReplace &&
    booking.monoInvoiceId &&
    booking.monoPageUrl &&
    /^https:\/\//i.test(booking.monoPageUrl)
  ) {
    try {
      const existing = await getMonoInvoiceStatus(booking.monoInvoiceId);
      const existingKop = Number(existing.amount);
      const wantedKop = Math.round(chargeAmountUah * 100);
      if (
        existing.status !== "success" &&
        Number.isSafeInteger(existingKop) &&
        existingKop === wantedKop
      ) {
        return NextResponse.json(
          {
            ok: true,
            invoiceId: booking.monoInvoiceId,
            pageUrl: booking.monoPageUrl,
            amount: chargeAmountUah,
            amountKind,
            testMode: testAmountUah != null,
            reference: orderId,
            reused: true,
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
      forceReplace = true;
    } catch {
      forceReplace = true;
    }
  }

  try {
    const invoice = await createMonoInvoice({
      reference: orderId,
      amountUah: chargeAmountUah,
      destination: `${amountKind === "full" ? "Оплата за" : "Передплата за"} ${
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
      force: forceReplace,
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
        amountKind,
        testMode: testAmountUah != null,
        reference: orderId,
        reused: false,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[MonoPay] Invoice creation failed", {
      orderId,
      amountKind,
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
