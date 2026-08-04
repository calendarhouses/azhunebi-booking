import { NextResponse } from "next/server";
import {
  expireBookingPayment,
  listPaymentLifecycle,
  type GasBookingRecord,
} from "@/lib/gas-api";
import { authorizeBearer, paymentLifecycleSecrets } from "@/lib/cron/authorize";
import { getMonoInvoiceStatus } from "@/lib/monopay/client";
import { getMonoTestAmountUah } from "@/lib/monopay/config";
import { isMonoChastBooking } from "@/lib/monoparts/config";
import { settleMonoPartsOrder } from "@/lib/monoparts/settle";
import { confirmBookingPayment } from "@/lib/payments/confirmBookingPayment";
import {
  sendBookingLifecycleSms,
  type BookingLifecycleSmsType,
} from "@/lib/sms/bookingLifecycleSms";
import { loadSmsSettingsSystem } from "@/lib/sms/loadSmsSettings";
import { notifyPaidBookingOnce } from "@/lib/telegram/paidBookingNotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  return authorizeBearer(request, paymentLifecycleSecrets());
}

function pendingSmsType(booking: GasBookingRecord): BookingLifecycleSmsType | null {
  if (booking.status === "Очікує оплату" && !booking.paymentLinkSmsSentAt) {
    return "payment_link";
  }
  if (booking.status === "Підтверджено" && !booking.successSmsSentAt) {
    return "success";
  }
  if (booking.status === "Скасовано" && booking.expiredAt && !booking.expirySmsSentAt) {
    return "expiry";
  }
  return null;
}

async function settleOrExpire(booking: GasBookingRecord): Promise<"paid" | "expired" | "skipped"> {
  const orderId = String(booking.id || "").trim();
  if (!orderId) return "skipped";

  if (booking.monoInvoiceId && isMonoChastBooking(booking)) {
    try {
      const settled = await settleMonoPartsOrder({
        orderId,
        monoOrderId: booking.monoInvoiceId,
        booking,
      });
      if (settled.ok && settled.settled) return "paid";
      if (settled.ok && settled.failed) {
        // Fall through to expiry when parts application failed.
      } else {
        return "skipped";
      }
    } catch (error) {
      console.error("[Payment lifecycle] Mono Parts status failed", {
        orderId,
        invoiceId: booking.monoInvoiceId,
        message: error instanceof Error ? error.message : String(error),
      });
      return "skipped";
    }
  } else if (booking.monoInvoiceId) {
    try {
      const invoice = await getMonoInvoiceStatus(booking.monoInvoiceId);
      if (invoice.status === "success") {
        const amountKopiykas = Number(invoice.amount);
        if (!Number.isSafeInteger(amountKopiykas) || amountKopiykas <= 0) {
          return "skipped";
        }
        const testMode = getMonoTestAmountUah() != null;
        const confirmed = await confirmBookingPayment(orderId, amountKopiykas / 100, {
          provider: "MonoPay",
          transactionId: booking.monoInvoiceId,
          testMode,
        });
        return confirmed.ok ? "paid" : "skipped";
      }
      if (invoice.status === "processing") return "skipped";
    } catch (error) {
      // Never release dates while MonoPay status is unavailable.
      console.error("[Payment lifecycle] Mono status failed", {
        orderId,
        invoiceId: booking.monoInvoiceId,
        message: error instanceof Error ? error.message : String(error),
      });
      return "skipped";
    }
  }

  const expired = await expireBookingPayment(orderId);
  if (expired.ok && expired.expired) {
    try {
      const { recordPaymentEvent } = await import("@/lib/payment/paymentJournal");
      await recordPaymentEvent({
        outcome: "expired",
        bookingId: orderId,
        guestName: String(booking.name || "").trim() || undefined,
        amount: Math.round(Number(booking.prepayAmount) || 0) || undefined,
        reason: "Час на оплату вичерпано",
        channel: "lifecycle",
      });
    } catch (err) {
      console.warn("[Payment lifecycle] journal failed", err);
    }
    return "expired";
  }
  return "skipped";
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const lifecycle = await listPaymentLifecycle();
    if (!lifecycle.ok) {
      const reason = lifecycle.reason || "GAS lifecycle unavailable";
      const timedOut = /timeout|aborted/i.test(reason);
      console.error("[Payment lifecycle] list failed", { reason, timedOut });
      return NextResponse.json(
        { error: reason, timedOut },
        { status: timedOut ? 504 : 502 }
      );
    }

    let paid = 0;
    let expired = 0;
    for (const booking of lifecycle.due || []) {
      try {
        const outcome = await settleOrExpire(booking);
        if (outcome === "paid") paid += 1;
        if (outcome === "expired") expired += 1;
      } catch (error) {
        console.error("[Payment lifecycle] settleOrExpire failed", {
          orderId: booking.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const refreshed = await listPaymentLifecycle();
    let smsSent = 0;
    let smsFailed = 0;
    let telegramSent = 0;
    let telegramFailed = 0;

    if (refreshed.ok) {
      const smsSettings = await loadSmsSettingsSystem();
      for (const booking of refreshed.pendingSms || []) {
        const type = pendingSmsType(booking);
        if (!type) continue;
        try {
          const result = await sendBookingLifecycleSms(booking, type, smsSettings);
          if (result.ok) smsSent += 1;
          else smsFailed += 1;
        } catch (error) {
          smsFailed += 1;
          console.error("[Payment lifecycle] SMS failed", {
            orderId: booking.id,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
      for (const booking of refreshed.pendingTelegram || []) {
        try {
          const outcome = await notifyPaidBookingOnce(booking);
          if (outcome === "sent" || outcome === "already") telegramSent += 1;
          else if (outcome === "failed") telegramFailed += 1;
        } catch (error) {
          telegramFailed += 1;
          console.error("[Payment lifecycle] Telegram failed", {
            orderId: booking.id,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } else {
      console.warn("[Payment lifecycle] refresh list failed", refreshed.reason);
    }

    return NextResponse.json(
      {
        ok: true,
        checked: lifecycle.due?.length || 0,
        paid,
        expired,
        smsSent,
        smsFailed,
        telegramSent,
        telegramFailed,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Payment lifecycle] unhandled", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
