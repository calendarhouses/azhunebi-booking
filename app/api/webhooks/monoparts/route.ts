import { NextResponse } from "next/server";
import { fetchBookingByDisplayId } from "@/lib/gas-api";
import { isMonoChastBooking, isMonoPartsConfigured } from "@/lib/monoparts/config";
import { settleMonoPartsOrder } from "@/lib/monoparts/settle";
import { verifyMonoChastSignature } from "@/lib/monoparts/signature";
import type { MonoChastCallbackPayload } from "@/lib/monoparts/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isMonoPartsConfigured()) {
    return NextResponse.json({ error: "Parts not configured" }, { status: 503 });
  }

  const signature = request.headers.get("signature") || "";
  const rawBody = await request.text();

  if (!verifyMonoChastSignature(rawBody, signature)) {
    console.error("[Mono Parts Webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let payload: MonoChastCallbackPayload;
  try {
    payload = JSON.parse(rawBody) as MonoChastCallbackPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const monoOrderId = String(payload.order_id || "").trim();
  const orderId =
    new URL(request.url).searchParams.get("orderId")?.trim() || "";

  if (!monoOrderId || !orderId) {
    console.error("[Mono Parts Webhook] Missing order ids", {
      monoOrderId,
      orderId,
      state: payload.state,
      sub: payload.order_sub_state,
    });
    return NextResponse.json({ error: "Missing order id" }, { status: 422 });
  }

  const bookingResult = await fetchBookingByDisplayId(orderId);
  if (!bookingResult.ok || !bookingResult.booking) {
    console.error("[Mono Parts Webhook] Booking not found", { orderId, monoOrderId });
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const booking = bookingResult.booking;
  if (
    booking.monoInvoiceId &&
    booking.monoInvoiceId !== monoOrderId &&
    isMonoChastBooking(booking)
  ) {
    console.error("[Mono Parts Webhook] Order id mismatch", {
      orderId,
      expected: booking.monoInvoiceId,
      got: monoOrderId,
    });
    return NextResponse.json({ error: "Order mismatch" }, { status: 422 });
  }

  const settled = await settleMonoPartsOrder({
    orderId,
    monoOrderId,
    booking,
  });

  console.log("[Mono Parts Webhook] Processed", {
    orderId,
    monoOrderId,
    state: payload.state,
    sub: payload.order_sub_state,
    settled,
  });

  if (!settled.ok) {
    return NextResponse.json(
      { error: settled.reason, message: settled.message },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, settled: settled.settled });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
