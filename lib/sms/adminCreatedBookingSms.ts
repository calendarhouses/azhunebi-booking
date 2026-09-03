import "server-only";

import type { GasBookingRecord } from "@/lib/gas-api-server";
import { markBookingSmsSent } from "@/lib/gas-api-server";
import { normalizeGuestPhone } from "@/lib/admin/guestMessengerLinks";
import { getPublicOrigin } from "@/lib/monopay/config";
import { loadAllSettings } from "@/lib/db/settings";
import {
  formatPaymentWindowPhrase,
  resolvePaymentWindowHours,
} from "@/lib/payment/paymentSettings";
import { isTurboSmsConfigured } from "./config";
import { sendTurboSms, type TurboSmsSendResult } from "./turbosms";
import {
  type SmsSettings,
  type SmsTemplateId,
  normalizeSmsSettings,
  renderSmsTemplate,
  buildSmsVarsFromBooking,
} from "./smsSettings";
import { makeSmsJournalEntry, recordSmsJournalEntry } from "./smsJournal";
import { guestCottageLabel } from "./guestCottageLabel";

function journalWebhookSecret(): string {
  return (
    process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    ""
  );
}

/** Admin created booking with no advance / surcharge recorded → guest pays online. */
export function adminBookingNeedsPaymentLink(booking: {
  prepayAmount?: unknown;
  surchargeAmount?: unknown;
  paidAmount?: unknown;
  totalPrice?: unknown;
}): boolean {
  const prepay = Math.round(Number(booking.prepayAmount) || 0);
  const surcharge = Math.round(Number(booking.surchargeAmount) || 0);
  const paid = Math.round(Number(booking.paidAmount) || 0);
  const total = Math.round(Number(booking.totalPrice) || 0);
  return prepay === 0 && surcharge === 0 && paid === 0 && total > 0;
}

function resolveAdminCreateTemplateId(
  booking: GasBookingRecord,
  onlinePaymentEnabled: boolean
): SmsTemplateId {
  if (onlinePaymentEnabled && adminBookingNeedsPaymentLink(booking)) {
    return "admin_payment";
  }
  return "admin_confirm";
}

export function buildAdminCreatedBookingSmsText(
  booking: GasBookingRecord,
  smsSettings?: SmsSettings,
  opts?: {
    cottage?: string;
    templateId?: SmsTemplateId;
    payUrl?: string;
    hours?: number;
    hoursPhrase?: string;
  }
): string {
  const settings = smsSettings ?? normalizeSmsSettings(undefined);
  const templateId = opts?.templateId || "admin_confirm";
  const template = settings.templates[templateId];
  const vars = buildSmsVarsFromBooking(booking, {
    cottage: opts?.cottage,
    payUrl: opts?.payUrl,
    hours: opts?.hours,
    hoursPhrase: opts?.hoursPhrase,
  });
  return renderSmsTemplate(template.text, vars);
}

export async function sendAdminCreatedBookingSms(
  booking: GasBookingRecord,
  smsSettings?: SmsSettings
): Promise<TurboSmsSendResult> {
  const settings = smsSettings ?? normalizeSmsSettings(undefined);

  let onlinePaymentEnabled = true;
  try {
    const { isOnlinePaymentEnabledServer } = await import(
      "@/lib/payment/loadPaymentSettings"
    );
    onlinePaymentEnabled = await isOnlinePaymentEnabledServer();
  } catch {
    /* keep true — still try payment template when amounts are 0/0 */
  }

  const templateId = resolveAdminCreateTemplateId(booking, onlinePaymentEnabled);
  const template = settings.templates[templateId];

  if (!template.enabled) {
    return { ok: true, responseStatus: "disabled" };
  }

  if (!isTurboSmsConfigured()) {
    return { ok: false, error: "TURBOSMS_TOKEN not configured" };
  }

  const phone = normalizeGuestPhone(booking.phone);
  if (!phone) {
    return { ok: false, error: "missing phone" };
  }

  const orderId = String(booking.id || "").trim();

  // Same claim as site payment_link — cron must not send a second payment SMS.
  if (templateId === "admin_payment" && orderId) {
    const claim = await markBookingSmsSent(orderId, "payment_link");
    if (!claim.ok) {
      return { ok: false, error: claim.reason || "claim_failed" };
    }
    if (claim.already || claim.claimed === false) {
      return { ok: true, responseStatus: "already sent" };
    }
  }

  const cottage = template.text.includes("{cottage}")
    ? await guestCottageLabel(booking)
    : undefined;

  let paymentWindowHours = 3;
  if (templateId === "admin_payment") {
    try {
      const all = await loadAllSettings();
      paymentWindowHours = resolvePaymentWindowHours(all.paymentSettings);
    } catch {
      /* keep default */
    }
  }

  const payUrl =
    templateId === "admin_payment" && orderId
      ? `${getPublicOrigin()}/pay/${encodeURIComponent(orderId)}`
      : undefined;

  const text = buildAdminCreatedBookingSmsText(booking, settings, {
    cottage,
    templateId,
    payUrl,
    hours: paymentWindowHours,
    hoursPhrase: formatPaymentWindowPhrase(paymentWindowHours),
  });

  const result = await sendTurboSms({
    phone,
    text,
    sequenceId: orderId ? `${templateId}-${orderId}` : undefined,
  });

  const secret = journalWebhookSecret();
  if (secret) {
    void recordSmsJournalEntry(
      makeSmsJournalEntry({
        type: templateId,
        phone,
        text,
        ok: result.ok,
        messageId: result.messageId,
        error: result.error || result.responseStatus,
        bookingId: orderId || undefined,
        pricePerSegment: settings.pricePerSegment,
      }),
      secret
    );
  }

  if (!result.ok) {
    if (templateId === "admin_payment" && orderId) {
      const { clearBookingSmsSent } = await import("@/lib/gas-api-server");
      const { isNonRetryableSmsResult } = await import("./bookingLifecycleSms");
      if (!isNonRetryableSmsResult(result)) {
        await clearBookingSmsSent(orderId, "payment_link");
      }
    }
    console.error(
      `[SMS] admin created booking (${templateId}) failed:`,
      result.error,
      result.responseStatus
    );
  }

  return result;
}
