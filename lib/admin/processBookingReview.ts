import type { GuestMessengerBooking } from "@/lib/admin/guestMessengerLinks";
import { fetchBookingByDisplayId, reviewBookingDecision } from "@/lib/gas-api-server";
import {
  formatSmsStatusLine,
  notifyGuestBookingRejected,
} from "@/lib/sms/notifyGuestBookingApproved";
import { sendBookingLifecycleSms } from "@/lib/sms/bookingLifecycleSms";
import { sendReviewLifecycleSms } from "@/lib/sms/reviewLifecycleSms";
import { loadSmsSettings, loadSmsSettingsSystem } from "@/lib/sms/loadSmsSettings";
import { hasReviewExceptionInComment } from "@/lib/sms/reviewRequestSmsVars";
import type { TurboSmsSendResult } from "@/lib/sms/turbosms";

export type BookingReviewDecision = "approve" | "reject";

export type ProcessBookingReviewResult = {
  ok: boolean;
  reason?: string;
  already?: boolean;
  orderId: string;
  decision: BookingReviewDecision;
  smsLine?: string;
  booking?: GuestMessengerBooking;
};

function toGuestBooking(
  orderId: string,
  booking: {
    name?: string;
    phone?: string;
    cottage?: string;
    checkIn?: string;
    checkOut?: string;
    prepayAmount?: number;
    totalPrice?: number;
  }
): GuestMessengerBooking {
  return {
    id: orderId,
    name: booking.name,
    phone: booking.phone,
    cottage: booking.cottage,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    prepayAmount: booking.prepayAmount,
    totalPrice: booking.totalPrice,
  };
}

async function sendReviewSms(
  decision: BookingReviewDecision,
  bookingRaw: Record<string, unknown>,
  orderId: string,
  reviewComment: string,
  smsSettings: Awaited<ReturnType<typeof loadSmsSettingsSystem>>
): Promise<{ sms: TurboSmsSendResult | null; smsSkipped: boolean }> {
  const record = { ...bookingRaw, id: orderId };
  if (decision === "approve") {
    const sms = await sendReviewLifecycleSms(record, "review_approve", smsSettings, reviewComment);
    return { sms, smsSkipped: false };
  }
  const sms = await sendReviewLifecycleSms(record, "review_reject", smsSettings, reviewComment);
  return { sms, smsSkipped: false };
}

async function finalizeTelegramUiQuietly(params: {
  orderId: string;
  decision: BookingReviewDecision;
  booking?: GuestMessengerBooking;
  smsLine?: string;
  telegramMessage?: { chatId: string | number; messageId: number };
}): Promise<void> {
  try {
    const { buildDecisionSummaryHtml } = await import("@/lib/telegram/bookingReviewNotify");
    const { finalizePendingReviewTelegramMessages } = await import(
      "@/lib/telegram/pendingReviewMessages"
    );
    const smsLine = params.smsLine || (params.decision === "approve" ? "Готово" : "Скасовано");
    const body = params.booking
      ? buildDecisionSummaryHtml(params.decision, params.booking, smsLine)
      : params.decision === "approve"
        ? `✅ <b>Прийнято</b>\n\n📱 ${smsLine}`
        : `❌ <b>Скасовано</b>\n\n📱 ${smsLine}`;
    await finalizePendingReviewTelegramMessages({
      orderId: params.orderId,
      decision: params.decision,
      bodyHtml: body,
      alsoEdit: params.telegramMessage,
    });
  } catch (err) {
    console.warn("[review] telegram finalize failed", err);
  }
}

export async function processBookingReview(params: {
  orderId: string;
  decision: BookingReviewDecision;
  adminAuth?: { token: string; tenantId: string };
  /** When decision came from a Telegram button, pass the source message to edit. */
  telegramMessage?: { chatId: string | number; messageId: number };
}): Promise<ProcessBookingReviewResult> {
  const orderId = params.orderId.trim();

  const preFetch = await fetchBookingByDisplayId(orderId).catch(() => null);
  const preBooking = preFetch?.booking;
  const preComment = String(preBooking?.comment || "");
  const wasReviewException = hasReviewExceptionInComment(
    preComment,
    preBooking?.checkIn,
    preBooking?.checkOut
  );

  const result = params.adminAuth
    ? await reviewBookingDecision({
        orderId,
        decision: params.decision,
        authToken: params.adminAuth.token,
        tenantId: params.adminAuth.tenantId,
      })
    : await reviewBookingDecision({
        orderId,
        decision: params.decision,
      });

  if (!result.ok) {
    const reason =
      result.reason ||
      (result as { error?: string }).error ||
      "update_failed";
    return {
      ok: false,
      reason: String(reason).toLowerCase().includes("unauthorized")
        ? "unauthorized"
        : String(reason),
      orderId,
      decision: params.decision,
    };
  }

  const already = Boolean(result.already);

  await clearPendingReviewRemindersQuietly();
  const bookingRaw =
    result.booking || (await fetchBookingByDisplayId(orderId).catch(() => null))?.booking;

  if (!bookingRaw) {
    console.warn("[review] ok but booking payload missing", orderId, params.decision);
    const smsLine =
      params.decision === "approve"
        ? already
          ? "Вже підтверджено раніше."
          : "Підтверджено, але дані броні не підвантажились для SMS."
        : already
          ? "Вже скасовано раніше."
          : "Скасовано, але дані броні не підвантажились для SMS.";
    await finalizeTelegramUiQuietly({
      orderId,
      decision: params.decision,
      smsLine,
      telegramMessage: params.telegramMessage,
    });
    return {
      ok: true,
      already,
      orderId,
      decision: params.decision,
      smsLine,
    };
  }

  const guestBooking = toGuestBooking(orderId, bookingRaw);

  // Duplicate click (admin then Telegram, or double Telegram): never send SMS again.
  if (already) {
    const smsLine =
      params.decision === "approve"
        ? "Вже підтверджено раніше. SMS не дублюємо."
        : "Вже скасовано раніше.";
    await finalizeTelegramUiQuietly({
      orderId,
      decision: params.decision,
      booking: guestBooking,
      smsLine,
      telegramMessage: params.telegramMessage,
    });
    return {
      ok: true,
      already: true,
      orderId,
      decision: params.decision,
      smsLine,
      booking: guestBooking,
    };
  }

  try {
    const smsSettings = params.adminAuth
      ? await loadSmsSettings({
          authToken: params.adminAuth.token,
          tenantId: params.adminAuth.tenantId,
        })
      : await loadSmsSettingsSystem();

    let notifyResult: { sms: TurboSmsSendResult | null; smsSkipped: boolean };
    if (wasReviewException) {
      notifyResult = await sendReviewSms(
        params.decision,
        bookingRaw as Record<string, unknown>,
        orderId,
        preComment,
        smsSettings
      );
    } else if (params.decision === "approve") {
      notifyResult = {
        sms: await sendBookingLifecycleSms(
          { ...bookingRaw, id: orderId },
          "payment_link",
          smsSettings
        ),
        smsSkipped: false,
      };
    } else {
      notifyResult = await notifyGuestBookingRejected(guestBooking, smsSettings);
    }

    const smsLine = formatSmsStatusLine(notifyResult, params.decision);
    await finalizeTelegramUiQuietly({
      orderId,
      decision: params.decision,
      booking: guestBooking,
      smsLine,
      telegramMessage: params.telegramMessage,
    });

    return {
      ok: true,
      orderId,
      decision: params.decision,
      smsLine,
      booking: guestBooking,
    };
  } catch (err) {
    console.error("[review] SMS notify threw", err);
    const smsLine =
      params.decision === "approve"
        ? "Підтверджено, але SMS не вдалося надіслати."
        : "Скасовано, але SMS не вдалося надіслати.";
    await finalizeTelegramUiQuietly({
      orderId,
      decision: params.decision,
      booking: guestBooking,
      smsLine,
      telegramMessage: params.telegramMessage,
    });
    return {
      ok: true,
      orderId,
      decision: params.decision,
      smsLine,
      booking: guestBooking,
    };
  }
}

async function clearPendingReviewRemindersQuietly(): Promise<void> {
  try {
    const { deleteStoredPendingReviewReminders } = await import(
      "@/lib/telegram/pendingReviewReminder"
    );
    await deleteStoredPendingReviewReminders();
  } catch (err) {
    console.warn("[review] reminder cleanup failed", err);
  }
}
