import "server-only";

import type { GasBookingRecord } from "@/lib/gas-api";
import { normalizeGuestPhone } from "@/lib/admin/guestMessengerLinks";
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

function journalWebhookSecret(): string {
  return (
    process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    ""
  );
}

export function buildAdminCreatedBookingSmsText(
  booking: GasBookingRecord,
  smsSettings?: SmsSettings,
  cottage?: string
): string {
  const settings = smsSettings ?? normalizeSmsSettings(undefined);
  const template = settings.templates.admin_confirm;
  const vars = buildSmsVarsFromBooking(booking, { cottage });
  return renderSmsTemplate(template.text, vars);
}

export async function sendAdminCreatedBookingSms(
  booking: GasBookingRecord,
  smsSettings?: SmsSettings
): Promise<TurboSmsSendResult> {
  const settings = smsSettings ?? normalizeSmsSettings(undefined);
  const template = settings.templates.admin_confirm;

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
  const cottage = template.text.includes("{cottage}")
    ? await guestCottageLabel(booking)
    : undefined;
  const text = buildAdminCreatedBookingSmsText(booking, settings, cottage);

  const result = await sendTurboSms({
    phone,
    text,
    sequenceId: orderId ? `admin_confirm-${orderId}` : undefined,
  });

  const secret = journalWebhookSecret();
  if (secret) {
    void recordSmsJournalEntry(
      makeSmsJournalEntry({
        type: "admin_confirm",
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
    console.error("[SMS] admin created booking notify failed:", result.error, result.responseStatus);
  }

  return result;
}
