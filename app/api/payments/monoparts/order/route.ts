import { NextResponse } from "next/server";
import { fetchBookingByDisplayId, storeMonoInvoice } from "@/lib/gas-api";
import { resolveMonoChargeAmountUah } from "@/lib/monopay/config";
import {
  createMonoChastOrder,
  getMonoChastOrderState,
  MonoChastApiError,
} from "@/lib/monoparts/client";
import {
  getPublicOrigin,
  isMonoAcquiringBooking,
  isMonoChastBooking,
  isMonoPartsConfigured,
  monoChastPageMarker,
  MONO_CHAST_PARTS_COUNT,
  parseMonoChastAmountKind,
  type MonoChastAmountKind,
} from "@/lib/monoparts/config";
import { isAwaitingPaymentStatus } from "@/lib/public-booking/bookingReview";
import { formatUaPhoneE164 } from "@/lib/public-booking/uaPhone";

export const runtime = "nodejs";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { ok: false, code, message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

function parseAmountKind(raw: unknown): MonoChastAmountKind | null {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "prepay" || value === "full") return value;
  return null;
}

function chargeForKind(
  booking: { prepayAmount?: number; totalPrice?: number },
  kind: MonoChastAmountKind
): number {
  const raw =
    kind === "prepay"
      ? Math.round(Number(booking.prepayAmount) || 0)
      : Math.round(Number(booking.totalPrice) || 0);
  return resolveMonoChargeAmountUah(raw);
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      enabled: isMonoPartsConfigured(),
      partsCount: [...MONO_CHAST_PARTS_COUNT],
      amountKinds: ["prepay", "full"],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  if (!isMonoPartsConfigured()) {
    return errorResponse(503, "PARTS_DISABLED", "Покупка частинами тимчасово недоступна");
  }

  let body: { orderId?: unknown; amountKind?: unknown };
  try {
    body = (await request.json()) as { orderId?: unknown; amountKind?: unknown };
  } catch {
    return errorResponse(400, "INVALID_BODY", "Некоректний запит");
  }

  const orderId = String(body.orderId || "").trim();
  const amountKind = parseAmountKind(body.amountKind) || "prepay";
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
  if (!Number.isFinite(deadlineMs) || deadlineMs - Date.now() < 60_000) {
    return errorResponse(409, "PAYMENT_EXPIRED", "Час резерву для оплати завершився");
  }

  if (isMonoAcquiringBooking(booking)) {
    return errorResponse(
      409,
      "ACQUIRING_STARTED",
      "Для цієї броні вже відкрито оплату MonoPay. Завершіть її або дочекайтесь закінчення резерву."
    );
  }

  let forceNewStoreOrder = false;
  if (isMonoChastBooking(booking) && booking.monoInvoiceId) {
    const existingKind = parseMonoChastAmountKind(booking.monoPageUrl) || "full";
    try {
      const state = await getMonoChastOrderState(booking.monoInvoiceId);
      const top = String(state.state || "").toUpperCase();
      if (top === "FAIL") {
        forceNewStoreOrder = true;
      } else if (existingKind !== amountKind) {
        return errorResponse(
          409,
          "PARTS_KIND_MISMATCH",
          "Для цієї броні вже відкрито інший варіант Покупки частинами. Дочекайтесь завершення або скасування в Monobank."
        );
      } else {
        return NextResponse.json(
          {
            ok: true,
            orderId: booking.monoInvoiceId,
            amount: chargeForKind(booking, existingKind),
            amountKind: existingKind,
            partsCount: [...MONO_CHAST_PARTS_COUNT],
            reused: true,
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
    } catch {
      if (existingKind !== amountKind) {
        return errorResponse(
          409,
          "PARTS_KIND_MISMATCH",
          "Для цієї броні вже відкрито інший варіант Покупки частинами."
        );
      }
      return NextResponse.json(
        {
          ok: true,
          orderId: booking.monoInvoiceId,
          amount: chargeForKind(booking, existingKind),
          amountKind: existingKind,
          partsCount: [...MONO_CHAST_PARTS_COUNT],
          reused: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  const chargeAmountUah = chargeForKind(booking, amountKind);
  if (!Number.isSafeInteger(chargeAmountUah) || chargeAmountUah < 2) {
    return errorResponse(409, "INVALID_AMOUNT", "Некоректна сума для Покупки частинами");
  }

  const phone = formatUaPhoneE164(String(booking.phone || ""));
  if (!/^\+380\d{9}$/.test(phone)) {
    return errorResponse(
      409,
      "INVALID_PHONE",
      "Для Покупки частинами потрібен коректний український номер телефону"
    );
  }

  const publicOrigin = getPublicOrigin();
  const cottage = String(booking.cottage || "бронювання").trim() || "бронювання";
  const productLabel =
    amountKind === "prepay"
      ? `${cottage} · передплата броні ${orderId}`
      : `${cottage} · повна оплата броні ${orderId}`;
  const storeOrderId = forceNewStoreOrder
    ? `${orderId}-pch-${amountKind}-${Date.now()}`.slice(0, 64)
    : `${orderId}-${amountKind}`.slice(0, 64);

  try {
    const created = await createMonoChastOrder({
      storeOrderId,
      clientPhone: phone,
      totalSumUah: chargeAmountUah,
      invoiceNumber: orderId,
      productName: productLabel,
      resultCallback: `${publicOrigin}/api/webhooks/monoparts?orderId=${encodeURIComponent(orderId)}`,
    });

    const stored = await storeMonoInvoice({
      orderId,
      invoiceId: created.orderId,
      pageUrl: monoChastPageMarker(amountKind),
      force: forceNewStoreOrder,
    });
    if (!stored.ok) {
      return errorResponse(409, "ORDER_NOT_STORED", "Не вдалося закріпити заявку ПЧ за бронюванням");
    }

    return NextResponse.json(
      {
        ok: true,
        orderId: stored.booking?.monoInvoiceId || created.orderId,
        amount: chargeAmountUah,
        amountKind,
        partsCount: [...MONO_CHAST_PARTS_COUNT],
        reused: false,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[Mono Parts] Order creation failed", {
      orderId,
      amountKind,
      status: error instanceof MonoChastApiError ? error.status : undefined,
      message: error instanceof Error ? error.message : String(error),
      body: error instanceof MonoChastApiError ? error.body : undefined,
    });

    if (error instanceof MonoChastApiError && error.status === 401) {
      return errorResponse(503, "MONO_AUTH_FAILED", "Mono відхилив підпис магазину ПЧ");
    }
    if (error instanceof MonoChastApiError && error.status === 403) {
      return errorResponse(503, "MONO_FORBIDDEN", "Створення заявок ПЧ заборонено для магазину");
    }
    return errorResponse(
      502,
      "MONO_UNAVAILABLE",
      error instanceof Error ? error.message : "Не вдалося створити заявку Покупки частинами"
    );
  }
}
