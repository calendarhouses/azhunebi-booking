import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin/verifyAdminRequest";
import { fetchBookingByDisplayId, recordBookingRefund } from "@/lib/gas-api-server";
import { cancelMonoInvoice, MonoApiError } from "@/lib/monopay/client";
import { returnMonoChastOrder, MonoChastApiError } from "@/lib/monoparts/client";
import {
  isMonoChastBooking,
  MONO_CHAST_PROVIDER,
} from "@/lib/monoparts/config";

export const runtime = "nodejs";
export const maxDuration = 60;

type RefundBody = {
  orderId?: unknown;
  amountUah?: unknown;
  cancelBooking?: unknown;
};

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id")?.trim() || null;
  const auth = await verifyAdminRequest(request, tenantId);
  if (auth instanceof NextResponse) return auth;

  let body: RefundBody;
  try {
    body = (await request.json()) as RefundBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const orderId = String(body.orderId || "").trim();
  const amountUah = Math.round(Number(body.amountUah) || 0);
  const cancelBooking = body.cancelBooking === true;

  if (!orderId || orderId.length > 120) {
    return NextResponse.json({ ok: false, error: "invalid_order" }, { status: 400 });
  }
  if (!(amountUah > 0)) {
    return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 });
  }

  const found = await fetchBookingByDisplayId(orderId);
  if (!found.ok || !found.booking) {
    return NextResponse.json({ ok: false, error: "booking_not_found" }, { status: 404 });
  }

  const booking = found.booking;
  const invoiceId = String(booking.monoInvoiceId || "").trim();
  const paidAmount = Math.round(Number(booking.paidAmount) || 0);

  if (!invoiceId) {
    return NextResponse.json(
      { ok: false, error: "no_online_payment" },
      { status: 409 }
    );
  }
  if (amountUah > paidAmount) {
    return NextResponse.json(
      { ok: false, error: "amount_exceeds_paid", paidAmount },
      { status: 400 }
    );
  }

  const isChast = isMonoChastBooking({
    monoPageUrl: booking.monoPageUrl,
    monoInvoiceId: booking.monoInvoiceId,
  });
  const method = isChast ? MONO_CHAST_PROVIDER : "MonoPay";

  try {
    if (isChast) {
      await returnMonoChastOrder({
        orderId: invoiceId,
        sumUah: amountUah,
        storeReturnId: `${orderId}-ret-${Date.now()}`.slice(0, 64),
      });
    } else {
      // Always pass an explicit amount so earlier partial refunds can't be
      // over-refunded (omitting amount cancels the full original invoice).
      await cancelMonoInvoice({
        invoiceId,
        amountUah,
        extRef: `${orderId}-ret-${Date.now()}`,
      });
    }
  } catch (err) {
    const status =
      err instanceof MonoApiError || err instanceof MonoChastApiError
        ? err.status || 502
        : 502;
    const message = err instanceof Error ? err.message : "Mono refund failed";
    console.error("[Refund] Mono refund failed", { orderId, isChast, message });
    return NextResponse.json(
      { ok: false, error: "mono_refund_failed", message },
      { status: status >= 400 && status < 600 ? status : 502 }
    );
  }

  const recorded = await recordBookingRefund({
    orderReference: orderId,
    amount: amountUah,
    method,
    note: `Повернення через ${method}`,
    transactionId: `${invoiceId}-${amountUah}`,
    cancelBooking,
    actorName: auth.name || auth.email,
    actorRole: auth.role,
  });

  if (!recorded.ok) {
    // Mono refund succeeded but journal write failed — surface a warning so the
    // admin adds the refund row manually (money already returned to the guest).
    console.error("[Refund] Mono refund OK but GAS record failed", {
      orderId,
      reason: recorded.reason,
      message: recorded.message,
    });
    return NextResponse.json(
      {
        ok: true,
        refunded: true,
        recorded: false,
        warning: "refund_not_journaled",
        amountUah,
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    refunded: true,
    recorded: true,
    amountUah,
    paidAmount: recorded.paidAmount,
  });
}
