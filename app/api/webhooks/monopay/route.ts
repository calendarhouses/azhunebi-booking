import { NextResponse } from "next/server";
import { fetchBookingByDisplayId } from "@/lib/gas-api";
import {
  getMonoTestAmountUah,
  resolveMonoChargeAmountUah,
} from "@/lib/monopay/config";
import { verifyMonoWebhookSignature } from "@/lib/monopay/signature";
import type { MonoWebhookPayload } from "@/lib/monopay/types";
import { confirmBookingPayment } from "@/lib/payments/confirmBookingPayment";
import { sendBookingLifecycleSms } from "@/lib/sms/bookingLifecycleSms";
import { loadSmsSettingsSystem } from "@/lib/sms/loadSmsSettings";
import { notifyPaidBookingOnce } from "@/lib/telegram/paidBookingNotify";

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
    const reference = String(payload.reference || "").trim();
    const { recordPaymentEvent } = await import("@/lib/payment/paymentJournal");
    await recordPaymentEvent({
      outcome: "failure",
      bookingId: reference || String(payload.invoiceId || "unknown"),
      amount: Number.isFinite(Number(payload.amount))
        ? Math.round(Number(payload.amount) / 100)
        : undefined,
      provider: "MonoPay",
      transactionId: String(payload.invoiceId || "").trim() || undefined,
      reason: String(payload.failureReason || status || "failed"),
      channel: "monopay",
      touchWebhook: true,
      webhookOk: false,
      webhookStatus: status || "failure",
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
  const expectedTotalUah = Math.round(
    Number(bookingResult.booking.totalPrice) || 0
  );
  const testAmountUah = getMonoTestAmountUah();
  const expectedPrepayKop = Math.round(
    resolveMonoChargeAmountUah(expectedPrepayUah) * 100
  );
  const expectedTotalKop = Math.round(
    resolveMonoChargeAmountUah(expectedTotalUah) * 100
  );
  const matchesPrepay = expectedPrepayKop > 0 && amountKopiykas === expectedPrepayKop;
  const matchesTotal = expectedTotalKop > 0 && amountKopiykas === expectedTotalKop;
  if (!matchesPrepay && !matchesTotal && testAmountUah == null) {
    console.error("[MonoPay Webhook] Amount mismatch", {
      reference,
      invoiceId,
      amountKopiykas,
      expectedPrepayKop,
      expectedTotalKop,
    });
    return NextResponse.json({ error: "Amount mismatch" }, { status: 422 });
  }
  if (testAmountUah != null) {
    const testKop = Math.round(testAmountUah * 100);
    if (amountKopiykas !== testKop && !matchesPrepay && !matchesTotal) {
      return NextResponse.json({ error: "Amount mismatch" }, { status: 422 });
    }
  }

  const providerBase = matchesTotal && !matchesPrepay ? "MonoPay повна" : "MonoPay";
  const result = await confirmBookingPayment(reference, amountKopiykas / 100, {
    provider: providerBase,
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
  if (result.updated) {
    const { recordPaymentEvent } = await import("@/lib/payment/paymentJournal");
    await recordPaymentEvent({
      outcome: "success",
      bookingId: reference,
      guestName: String(bookingResult.booking.name || "").trim() || undefined,
      amount: amountKopiykas / 100,
      provider: providerBase,
      transactionId: invoiceId,
      channel: "monopay",
      touchWebhook: true,
      webhookOk: true,
      webhookStatus: "success",
    });
  } else {
    const { touchPaymentWebhook } = await import("@/lib/payment/paymentJournal");
    await touchPaymentWebhook({
      ok: true,
      status: "success_idempotent",
      channel: "monopay",
    });
  }
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
    const tg = await notifyPaidBookingOnce(confirmedBooking.booking);
    if (tg === "failed") {
      console.error("[MonoPay Webhook] Paid Telegram notify failed", { reference });
    }
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
