import { NextResponse } from "next/server";
import {
  fetchBookingByDisplayId,
  markPaidBookingTelegramSent,
} from "@/lib/gas-api";
import {
  getMonoTestAmountUah,
  resolveMonoChargeAmountUah,
} from "@/lib/monopay/config";
import { verifyMonoWebhookSignature } from "@/lib/monopay/signature";
import type { MonoWebhookPayload } from "@/lib/monopay/types";
import { confirmBookingPayment } from "@/lib/payments/confirmBookingPayment";
import { sendBookingLifecycleSms } from "@/lib/sms/bookingLifecycleSms";
import { loadSmsSettingsSystem } from "@/lib/sms/loadSmsSettings";
import { notifyPaidBooking } from "@/lib/telegram/paidBookingNotify";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("x-sign") || "";
  const rawBody = Buffer.from(await request.arrayBuffer());

  let signatureValid = false;
  try {
    signatureValid = await verifyMonoWebhookSignature(rawBody, signature);
  } catch (error) {
    console.error("[MonoPay Webhook] Signature verification unavailable", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Verification unavailable" }, { status: 503 });
  }

  if (!signatureValid) {
    console.error("[MonoPay Webhook] Invalid x-sign");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let payload: MonoWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString("utf8")) as MonoWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const status = String(payload.status || "");
  if (status !== "success") {
    console.log("[MonoPay Webhook] Ignored non-success status", {
      invoiceId: payload.invoiceId,
      status,
      modifiedDate: payload.modifiedDate,
    });
    return NextResponse.json({ ok: true });
  }

  const reference = String(payload.reference || "").trim();
  const invoiceId = String(payload.invoiceId || "").trim();
  const amountKopiykas = Number(payload.amount);

  if (
    !reference ||
    !invoiceId ||
    payload.ccy !== 980 ||
    !Number.isSafeInteger(amountKopiykas) ||
    amountKopiykas <= 0
  ) {
    console.error("[MonoPay Webhook] Invalid success payload", {
      reference,
      invoiceId,
      amount: payload.amount,
      ccy: payload.ccy,
    });
    return NextResponse.json({ error: "Invalid payment data" }, { status: 422 });
  }

  const bookingResult = await fetchBookingByDisplayId(reference);
  if (!bookingResult.ok || !bookingResult.booking) {
    console.error("[MonoPay Webhook] Booking not found", { reference, invoiceId });
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const expectedPrepayUah = Math.round(
    Number(bookingResult.booking.prepayAmount) || 0
  );
  const testAmountUah = getMonoTestAmountUah();
  const expectedKopiykas =
    Math.round(resolveMonoChargeAmountUah(expectedPrepayUah) * 100);
  if (expectedKopiykas <= 0 || amountKopiykas !== expectedKopiykas) {
    console.error("[MonoPay Webhook] Amount mismatch", {
      reference,
      invoiceId,
      amountKopiykas,
      expectedKopiykas,
    });
    return NextResponse.json({ error: "Amount mismatch" }, { status: 422 });
  }

  const result = await confirmBookingPayment(reference, amountKopiykas / 100, {
    provider: testAmountUah != null ? "MonoPay TEST" : "MonoPay",
    transactionId: invoiceId,
    testMode: testAmountUah != null,
  });
  if (!result.ok) {
    const statusCode = result.reason === "amount_mismatch" ? 422 : 503;
    return NextResponse.json(
      { error: result.reason, message: result.message },
      { status: statusCode }
    );
  }

  console.log("[MonoPay Webhook] Payment confirmed", {
    reference,
    invoiceId,
    updated: result.updated,
  });
  const confirmedBooking = await fetchBookingByDisplayId(reference);
  if (confirmedBooking.ok && confirmedBooking.booking) {
    const smsSettings = await loadSmsSettingsSystem();
    const sms = await sendBookingLifecycleSms(
      confirmedBooking.booking,
      "success",
      smsSettings,
    );
    if (!sms.ok) {
      console.error("[MonoPay Webhook] Success SMS failed", {
        reference,
        error: sms.error || sms.responseStatus,
      });
    }
    if (!confirmedBooking.booking.paidTelegramSentAt) {
      const telegramSent = await notifyPaidBooking(confirmedBooking.booking);
      if (telegramSent) {
        await markPaidBookingTelegramSent(reference);
      }
    }
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
