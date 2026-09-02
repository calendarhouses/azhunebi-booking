import "server-only";

import {
  clearBookingSmsSent,
  markBookingSmsSent,
  type GasBookingRecord,
} from "@/lib/gas-api";
import { normalizeGuestPhone } from "@/lib/admin/guestMessengerLinks";
import { getPublicOrigin } from "@/lib/monopay/config";
import { loadAllSettings } from "@/lib/db/settings";
import {
  formatPaymentWindowPhrase,
  resolvePaymentWindowHours,
} from "@/lib/payment/paymentSettings";
import type { AdminSettingsPayload, CustomServiceConfig } from "@/components/admin/desktop/types";
import { isTurboSmsConfigured } from "./config";
import { isNonRetryableSmsResult } from "./bookingLifecycleSms";
import { sendTurboSms, type TurboSmsSendResult } from "./turbosms";
import {
  type SmsSettings,
  normalizeSmsSettings,
  renderSmsTemplate,
  buildSmsVarsFromBooking,
} from "./smsSettings";
import { makeSmsJournalEntry, recordSmsJournalEntry } from "./smsJournal";
import { guestCottageLabel } from "./guestCottageLabel";
import { buildReviewSmsExtraVars } from "./reviewRequestSmsVars";

export type ReviewLifecycleSmsType = "review_approve" | "review_reject";

function journalWebhookSecret(): string {
  return (
    process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    ""
  );
}

function servicesByIdFromList(
  services: AdminSettingsPayload["customServicesList"]
): Map<number, CustomServiceConfig> {
  return new Map((services || []).map((s) => [Number(s.id), s] as const));
}

export function buildReviewLifecycleSmsText(
  booking: GasBookingRecord,
  type: ReviewLifecycleSmsType,
  smsSettings?: SmsSettings,
  cottage?: string,
  paymentWindowHours?: number,
  reviewComment?: string,
  servicesById?: Map<number, CustomServiceConfig>
): string {
  const settings = smsSettings ?? normalizeSmsSettings(undefined);
  const template = settings.templates[type];
  const orderId = String(booking.id || "").trim();
  const payUrl = orderId
    ? `${getPublicOrigin()}/pay/${encodeURIComponent(orderId)}`
    : getPublicOrigin();
  const hours = paymentWindowHours ?? 3;
  const comment = reviewComment || String(booking.comment || "");
  const vars = {
    ...buildSmsVarsFromBooking(booking, {
      payUrl,
      cottage,
      hours,
      hoursPhrase: formatPaymentWindowPhrase(hours),
    }),
    ...buildReviewSmsExtraVars(comment, servicesById),
  };
  return renderSmsTemplate(template.text, vars);
}

export async function sendReviewLifecycleSms(
  booking: GasBookingRecord,
  type: ReviewLifecycleSmsType,
  smsSettings?: SmsSettings,
  reviewComment?: string
): Promise<TurboSmsSendResult> {
  const settings = smsSettings ?? normalizeSmsSettings(undefined);
  const template = settings.templates[type];

  if (!template.enabled) {
    return { ok: true, responseStatus: "disabled" };
  }

  if (!isTurboSmsConfigured()) {
    return { ok: false, error: "TURBOSMS_TOKEN not configured" };
  }

  const phone = normalizeGuestPhone(booking.phone);
  if (!phone) return { ok: false, error: "missing phone" };

  const orderId = String(booking.id || "").trim();
  let claimedPaymentLink = false;

  // Block payment-lifecycle cron from sending a duplicate payment_link SMS.
  if (type === "review_approve" && orderId && !booking.paymentLinkSmsSentAt) {
    const claim = await markBookingSmsSent(orderId, "payment_link");
    if (claim.ok && !claim.already && claim.claimed !== false) {
      claimedPaymentLink = true;
    }
  }

  let paymentWindowHours = 3;
  let servicesById: Map<number, CustomServiceConfig> | undefined;
  try {
    const { loadAllSettings, getSettingsPayload } = await import("@/lib/db/settings");
    const all = await loadAllSettings();
    paymentWindowHours = resolvePaymentWindowHours(all.paymentSettings);
    const settingsPayload = (await getSettingsPayload({
      omitSms: true,
      omitTeam: true,
      omitTransactions: true,
    })) as AdminSettingsPayload;
    servicesById = servicesByIdFromList(settingsPayload.customServicesList);
  } catch {
    /* keep defaults */
  }

  const cottage = template.text.includes("{cottage}")
    ? await guestCottageLabel(booking)
    : undefined;
  const text = buildReviewLifecycleSmsText(
    booking,
    type,
    settings,
    cottage,
    paymentWindowHours,
    reviewComment,
    servicesById
  );

  const result = await sendTurboSms({
    phone,
    text,
    sequenceId: orderId ? `${type}-${orderId}` : undefined,
  });

  if (
    !result.ok &&
    claimedPaymentLink &&
    orderId &&
    !isNonRetryableSmsResult(result)
  ) {
    await clearBookingSmsSent(orderId, "payment_link");
    console.error("[SMS] review_approve failed after claim — marker cleared", {
      orderId,
      status: result.responseStatus || result.error,
    });
  }

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
      secret
    );
  }

  return result;
}
