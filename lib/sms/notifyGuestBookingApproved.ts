import type { GuestMessengerBooking } from "@/lib/admin/guestMessengerLinks";
import { sendBookingApprovedSms } from "@/lib/sms/bookingApprovedSms";
import { isTurboSmsConfigured } from "@/lib/sms/config";
import type { TurboSmsSendResult } from "@/lib/sms/turbosms";

export type GuestApprovalNotifyResult = {
  sms: TurboSmsSendResult | null;
  smsSkipped: boolean;
};

export async function notifyGuestBookingApproved(
  booking: GuestMessengerBooking
): Promise<GuestApprovalNotifyResult> {
  if (!isTurboSmsConfigured()) {
    console.warn("[SMS] Skipping approved booking SMS — TURBOSMS_TOKEN not set");
    return { sms: null, smsSkipped: true };
  }

  const sms = await sendBookingApprovedSms(booking);
  if (!sms.ok) {
    console.error("[SMS] approved booking notify failed:", sms.error, sms.responseStatus);
  }
  return { sms, smsSkipped: false };
}

export function formatSmsStatusLine(result: GuestApprovalNotifyResult): string {
  if (result.smsSkipped) {
    return "SMS не налаштовано (немає TURBOSMS_TOKEN).";
  }
  if (result.sms?.ok) {
    return "SMS надіслано гостю.";
  }
  return `SMS не надіслано: ${result.sms?.error || result.sms?.responseStatus || "помилка"}`;
}
