import { NextResponse } from "next/server";
import { confirmBookingPayment } from "@/lib/wayforpay/confirmBookingPayment";
import {
  buildWebhookAcceptResponse,
  requireWayForPaySecretKey,
  verifyCallbackSignature,
} from "@/lib/wayforpay/signature";
import type { WayForPayCallbackPayload } from "@/lib/wayforpay/types";

export const runtime = "nodejs";

async function parseCallbackBody(request: Request): Promise<WayForPayCallbackPayload | null> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return (await request.json()) as WayForPayCallbackPayload;
    } catch {
      return null;
    }
  }

  try {
    const text = await request.text();
    if (!text.trim()) return null;
    if (text.trim().startsWith("{")) {
      return JSON.parse(text) as WayForPayCallbackPayload;
    }
    const params = new URLSearchParams(text);
    const obj: Record<string, string> = {};
    params.forEach((v, k) => {
      obj[k] = v;
    });
    return obj as WayForPayCallbackPayload;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  console.log("[WayForPay Webhook] Incoming POST", {
    contentType: request.headers.get("content-type"),
    at: new Date().toISOString(),
  });

  let secretKey: string;
  try {
    secretKey = requireWayForPaySecretKey();
  } catch (err) {
    console.error("[WayForPay Webhook] Missing WAYFORPAY_SECRET_KEY:", err);
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const payload = await parseCallbackBody(request);
  if (!payload || !payload.orderReference) {
    console.error("[WayForPay Webhook] Invalid or empty body");
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const orderReference = String(payload.orderReference);
  const transactionStatus = String(payload.transactionStatus || "");

  console.log("[WayForPay Webhook] Payload summary", {
    orderReference,
    transactionStatus,
    amount: payload.amount,
    merchantAccount: payload.merchantAccount,
  });

  if (!verifyCallbackSignature(payload, secretKey)) {
    console.error("[WayForPay Webhook] Invalid merchantSignature", { orderReference });
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  console.log("[WayForPay Webhook] Signature OK", { orderReference });

  if (transactionStatus === "Approved") {
    const amountPaid = Number(payload.amount);
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      console.error("[WayForPay Webhook] Approved but invalid amount", {
        orderReference,
        amount: payload.amount,
      });
    } else {
      const result = await confirmBookingPayment(orderReference, amountPaid);
      if (!result.ok) {
        console.error("[WayForPay Webhook] DB update failed", {
          orderReference,
          reason: result.reason,
          message: result.message,
        });
        // Still return accept so WayForPay stops retrying; ops can reconcile manually.
      } else {
        console.log("[WayForPay Webhook] Booking processed", {
          orderReference,
          updated: result.updated,
          bookingId: result.bookingId,
        });
      }
    }
  } else {
    console.log("[WayForPay Webhook] Non-approved status, no DB change", {
      orderReference,
      transactionStatus,
      reason: payload.reason,
      reasonCode: payload.reasonCode,
    });
  }

  const responseBody = buildWebhookAcceptResponse(orderReference, secretKey);

  console.log("[WayForPay Webhook] Responding accept", {
    orderReference,
    time: responseBody.time,
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json(responseBody);
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
