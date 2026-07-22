import { NextResponse } from "next/server";
import {
  expireBookingPayment,
  listPaymentLifecycle,
  markPaidBookingTelegramSent,
  type GasBookingRecord,
} from "@/lib/gas-api";
import { getMonoInvoiceStatus } from "@/lib/monopay/client";
import { getMonoTestAmountUah } from "@/lib/monopay/config";
import { confirmBookingPayment } from "@/lib/payments/confirmBookingPayment";
import {
  sendBookingLifecycleSms,
  type BookingLifecycleSmsType,
} from "@/lib/sms/bookingLifecycleSms";
import { loadSmsSettingsSystem } from "@/lib/sms/loadSmsSettings";
import { notifyPaidBooking } from "@/lib/telegram/paidBookingNotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const authorization = request.headers.get("authorization") || "";
  const secrets = [
    process.env.PAYMENT_LIFECYCLE_SECRET?.trim(),
    process.env.CRON_SECRET?.trim(),
    process.env.TELEGRAM_CRON_SECRET?.trim(),
  ].filter(Boolean) as string[];
  if (!secrets.length) return false;
  return secrets.some((secret) => authorization === `Bearer ${secret}`);
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

  if (booking.monoInvoiceId) {
    try {
      const invoice = await getMonoInvoiceStatus(booking.monoInvoiceId);
      if (invoice.status === "success") {
        const amountKopiykas = Number(invoice.amount);
        if (!Number.isSafeInteger(amountKopiykas) || amountKopiykas <= 0) {
          return "skipped";
        }
        const testMode = getMonoTestAmountUah() != null;
        const confirmed = await confirmBookingPayment(orderId, amountKopiykas / 100, {
          provider: testMode ? "MonoPay TEST" : "MonoPay",
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
  return expired.ok && expired.expired ? "expired" : "skipped";
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
          const sent = await notifyPaidBooking(booking);
          if (sent && booking.id) {
            const marked = await markPaidBookingTelegramSent(booking.id);
            if (marked.ok) telegramSent += 1;
            else telegramFailed += 1;
          } else {
            telegramFailed += 1;
          }
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

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
