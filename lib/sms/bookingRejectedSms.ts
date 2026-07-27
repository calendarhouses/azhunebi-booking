import "server-only";

import {
  normalizeGuestPhone,
  type GuestMessengerBooking,
} from "@/lib/admin/guestMessengerLinks";
import { sendTurboSms, type TurboSmsSendResult } from "./turbosms";
import {
  type SmsSettings,
  normalizeSmsSettings,
  renderSmsTemplate,
} from "./smsSettings";
import { makeSmsJournalEntry, recordSmsJournalEntry } from "./smsJournal";
import { guestCottageLabel } from "./guestCottageLabel";

const UK_MONTHS = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

function formatGuestDateShort(value?: string): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getDate()} ${UK_MONTHS[d.getMonth()]}`;
}

function buildRejectVars(
  booking: GuestMessengerBooking,
  cottage?: string,
): Record<string, string> {
  const firstName =
    String(booking.name || "Гість")
      .trim()
      .split(/\s+/)[0] || "Гість";
  return {
    name: firstName,
    cottage: cottage || booking.cottage || "обраний будинок",
    check_in: formatGuestDateShort(booking.checkIn),
    check_out: formatGuestDateShort(booking.checkOut),
  };
}

function journalWebhookSecret(): string {
  return (
    process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    ""
  );
}

export function buildGuestRejectedSmsText(
  booking: GuestMessengerBooking,
  smsSettings?: SmsSettings,
  cottage?: string,
): string {
  const settings = smsSettings ?? normalizeSmsSettings(undefined);
  const template = settings.templates.reject;
  return renderSmsTemplate(template.text, buildRejectVars(booking, cottage));
}

export async function sendBookingRejectedSms(
  booking: GuestMessengerBooking,
  smsSettings?: SmsSettings,
): Promise<TurboSmsSendResult> {
  const settings = smsSettings ?? normalizeSmsSettings(undefined);
  const template = settings.templates.reject;

  if (!template.enabled) {
    return { ok: true, responseStatus: "disabled" };
  }

  const phone = normalizeGuestPhone(booking.phone);
  if (!phone) {
    return { ok: false, error: "missing phone" };
  }

  const cottage = template.text.includes("{cottage}")
    ? await guestCottageLabel(booking)
    : undefined;
  const text = buildGuestRejectedSmsText(booking, settings, cottage);
  const orderId = String(booking.id || "").trim();
  const result = await sendTurboSms({
    phone,
    text,
    sequenceId: orderId ? `reject-${orderId}` : undefined,
  });

  const secret = journalWebhookSecret();
  if (secret) {
    void recordSmsJournalEntry(
      makeSmsJournalEntry({
        type: "reject",
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

  return result;
}
