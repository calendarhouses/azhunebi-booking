import "server-only";

import {
  markBookingSmsSent,
  clearBookingSmsSent,
  type GasBookingRecord,
} from "@/lib/gas-api-server";
import {
  normalizeGuestPhone,
} from "@/lib/admin/guestMessengerLinks";
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
  normalizeSmsSettings,
  renderSmsTemplate,
  buildSmsVarsFromBooking,
} from "./smsSettings";
import { makeSmsJournalEntry, recordSmsJournalEntry } from "./smsJournal";
import { guestCottageLabel } from "./guestCottageLabel";

export type BookingLifecycleSmsType = "payment_link" | "success" | "expiry";

/** TurboSMS statuses that mean "do not retry" — treat as terminal for our marker. */
const NON_RETRYABLE_SMS_STATUSES = new Set([
  "NOT_ALLOWED_MESSAGE_DUPLICATE",
  "NOT_ALLOWED_RECIPIENTS_NUMBER",
  "NOT_ALLOWED_RECIPIENT_COUNTRY",
  "NOT_ALLOWED_RECIPIENTS_LIMIT",
  "NOT_ALLOWED_MESSAGE_TEXT_EMPTY",
  "NOT_ALLOWED_MESSAGE_TEXT",
  "NOT_ALLOWED_SENDER_ID",
]);

function isNonRetryableSmsResult(result: TurboSmsSendResult): boolean {
  const status = String(result.responseStatus || result.error || "").trim();
  return NON_RETRYABLE_SMS_STATUSES.has(status);
}

export { isNonRetryableSmsResult };

function journalWebhookSecret(): string {
  return (
    process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    ""
  );
}

export function buildBookingLifecycleSmsText(
  booking: GasBookingRecord,
  type: BookingLifecycleSmsType,
  smsSettings?: SmsSettings,
  cottage?: string,
  paymentWindowHours?: number,
): string {
  const settings = smsSettings ?? normalizeSmsSettings(undefined);
  const template = settings.templates[type];
  const orderId = String(booking.id || "").trim();

  const payUrl = orderId
    ? `${getPublicOrigin()}/pay/${encodeURIComponent(orderId)}`
    : getPublicOrigin();

  const hours = paymentWindowHours ?? 3;
  const vars = buildSmsVarsFromBooking(booking, {
    payUrl,
    cottage,
    hours,
    hoursPhrase: formatPaymentWindowPhrase(hours),
  });
  return renderSmsTemplate(template.text, vars);
}

export async function sendBookingLifecycleSms(
  booking: GasBookingRecord,
  type: BookingLifecycleSmsType,
  smsSettings?: SmsSettings,
): Promise<TurboSmsSendResult> {
  const settings = smsSettings ?? normalizeSmsSettings(undefined);
  const template = settings.templates[type];

  if (!template.enabled) {
    return { ok: true, responseStatus: "disabled" };
  }

  const alreadySent =
    (type === "payment_link" && booking.paymentLinkSmsSentAt) ||
    (type === "success" && booking.successSmsSentAt) ||
    (type === "expiry" && booking.expirySmsSentAt);
  if (alreadySent) return { ok: true, responseStatus: "already sent" };

  if (!isTurboSmsConfigured()) {
    return { ok: false, error: "TURBOSMS_TOKEN not configured" };
  }

  const phone = normalizeGuestPhone(booking.phone);
  if (!phone) return { ok: false, error: "missing phone" };

  const orderId = String(booking.id || "").trim();

  // Claim marker under GAS lock BEFORE send — stops gas-proxy + cron races.
  if (orderId) {
    const claim = await markBookingSmsSent(orderId, type);
    if (!claim.ok) {
      return { ok: false, error: claim.reason || "claim_failed" };
    }
    if (claim.already || claim.claimed === false) {
      return { ok: true, responseStatus: "already sent" };
    }
  }

  // Guests only ever saw the public listing name — resolve it, but skip the
  // lookup entirely when the template has no {cottage} placeholder.
  const cottage = template.text.includes("{cottage}")
    ? await guestCottageLabel(booking)
    : undefined;
  let paymentWindowHours = 3;
  try {
    const all = await loadAllSettings();
    paymentWindowHours = resolvePaymentWindowHours(all.paymentSettings);
  } catch {
    /* keep default */
  }
  const text = buildBookingLifecycleSmsText(
    booking,
    type,
    settings,
    cottage,
    paymentWindowHours
  );

  const result = await sendTurboSms({
    phone,
    text,
    sequenceId: orderId ? `${type}-${orderId}` : undefined,
  });

  const secret = journalWebhookSecret();
  if (secret) {
    void recordSmsJournalEntry(
      makeSmsJournalEntry({
        type,
        phone,
        text,
        ok: result.ok,
        messageId: result.messageId,
        error: result.error || result.responseStatus,
        bookingId: orderId || undefined,
        pricePerSegment: settings.pricePerSegment,
      }),
      secret,
    );
  }

  if (!result.ok && orderId && !isNonRetryableSmsResult(result)) {
    // Allow cron/manual retry after transient provider errors.
    await clearBookingSmsSent(orderId, type);
    console.error("[SMS] Send failed after claim — marker cleared for retry", {
      orderId,
      type,
      status: result.responseStatus || result.error,
    });
  }
  return result;
}
