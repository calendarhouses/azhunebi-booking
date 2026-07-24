import "server-only";

import { fetchBookingByDisplayId, clearMonoPaymentAttempt, type GasBookingRecord } from "@/lib/gas-api";
import {
  getMonoChastTestAmountUah,
  resolveMonoChastChargeAmountUah,
} from "@/lib/monopay/config";
import { confirmBookingPayment } from "@/lib/payments/confirmBookingPayment";
import { sendBookingLifecycleSms } from "@/lib/sms/bookingLifecycleSms";
import { loadSmsSettingsSystem } from "@/lib/sms/loadSmsSettings";
import { notifyPaidBookingOnce } from "@/lib/telegram/paidBookingNotify";
import {
  confirmMonoChastOrder,
  getMonoChastOrderState,
  MonoChastApiError,
} from "./client";
import {
  MONO_CHAST_PROVIDER_FULL,
  MONO_CHAST_PROVIDER_PREPAY,
  parseMonoChastAmountKind,
  type MonoChastAmountKind,
} from "./config";

export type SettleMonoPartsResult =
  | {
      ok: true;
      settled: boolean;
      waitingClient?: boolean;
      failed?: boolean;
      message?: string;
      subState?: string;
    }
  | { ok: false; reason: string; message?: string };

function amountKindForBooking(booking: GasBookingRecord): MonoChastAmountKind {
  return parseMonoChastAmountKind(booking.monoPageUrl) || "full";
}

function expectedPartsAmountUah(booking: GasBookingRecord): number {
  const kind = amountKindForBooking(booking);
  const raw =
    kind === "prepay"
      ? Math.round(Number(booking.prepayAmount) || 0)
      : Math.round(Number(booking.totalPrice) || 0);
  return resolveMonoChastChargeAmountUah(raw);
}

function providerForBooking(booking: GasBookingRecord): string {
  const base =
    amountKindForBooking(booking) === "prepay"
      ? MONO_CHAST_PROVIDER_PREPAY
      : MONO_CHAST_PROVIDER_FULL;
  return getMonoChastTestAmountUah() != null ? `${base} TEST` : base;
}

async function markBookingPaidFromParts(
  orderId: string,
  booking: GasBookingRecord,
  monoOrderId: string
): Promise<SettleMonoPartsResult> {
  const amountUah = expectedPartsAmountUah(booking);
  if (amountUah < 2) {
    return { ok: false, reason: "invalid_amount", message: "Некоректна сума броні" };
  }

  const testMode = getMonoChastTestAmountUah() != null;
  const result = await confirmBookingPayment(orderId, amountUah, {
    provider: providerForBooking(booking),
    transactionId: monoOrderId,
    testMode,
  });
  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      message: result.message,
    };
  }

  if (result.updated) {
    const confirmed = await fetchBookingByDisplayId(orderId);
    if (confirmed.ok && confirmed.booking) {
      const smsSettings = await loadSmsSettingsSystem();
      const sms = await sendBookingLifecycleSms(confirmed.booking, "success", smsSettings);
      if (!sms.ok) {
        console.error("[Mono Parts] Success SMS failed", {
          orderId,
          error: sms.error || sms.responseStatus,
        });
      }
      const tg = await notifyPaidBookingOnce(confirmed.booking);
      if (tg === "failed") {
        console.error("[Mono Parts] Paid Telegram notify failed", { orderId });
      }
    }
  }

  return { ok: true, settled: true };
}

/**
 * After guest confirms in Monobank: auto-confirm store side (no physical goods)
 * and mark booking fully paid.
 */
export async function settleMonoPartsOrder(params: {
  orderId: string;
  monoOrderId: string;
  booking?: GasBookingRecord;
}): Promise<SettleMonoPartsResult> {
  const orderId = params.orderId.trim();
  const monoOrderId = params.monoOrderId.trim();
  if (!orderId || !monoOrderId) {
    return { ok: false, reason: "invalid_ids" };
  }

  let booking = params.booking;
  if (!booking) {
    const loaded = await fetchBookingByDisplayId(orderId);
    if (!loaded.ok || !loaded.booking) {
      return { ok: false, reason: "not_found" };
    }
    booking = loaded.booking;
  }

  if (booking.status === "Підтверджено") {
    return { ok: true, settled: true };
  }

  let state: string;
  let subState: string;
  try {
    const status = await getMonoChastOrderState(monoOrderId);
    state = String(status.state || "").toUpperCase();
    subState = String(status.order_sub_state || "").toUpperCase();
  } catch (error) {
    return {
      ok: false,
      reason: "mono_unavailable",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (state === "SUCCESS" && (subState === "ACTIVE" || subState === "DONE")) {
    return markBookingPaidFromParts(orderId, booking, monoOrderId);
  }

  if (state === "FAIL") {
    try {
      await clearMonoPaymentAttempt(orderId);
    } catch (error) {
      console.error("[Mono Parts] Failed to clear payment attempt after FAIL", {
        orderId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return {
      ok: true,
      settled: false,
      failed: true,
      message: failMessage(subState),
      subState,
    };
  }

  if (state === "IN_PROCESS" && subState === "WAITING_FOR_STORE_CONFIRM") {
    try {
      await confirmMonoChastOrder(monoOrderId);
    } catch (error) {
      // Idempotent race: another worker may have confirmed already.
      if (!(error instanceof MonoChastApiError && error.status === 400)) {
        console.error("[Mono Parts] confirm failed", {
          orderId,
          monoOrderId,
          message: error instanceof Error ? error.message : String(error),
        });
        return {
          ok: false,
          reason: "confirm_failed",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }
    return markBookingPaidFromParts(orderId, booking, monoOrderId);
  }

  if (state === "IN_PROCESS" && subState === "WAITING_FOR_CLIENT") {
    return { ok: true, settled: false, waitingClient: true };
  }

  return {
    ok: true,
    settled: false,
    message: `Невідомий статус ПЧ: ${state}/${subState}`,
  };
}

function failMessage(subState: string): string {
  switch (subState) {
    case "CLIENT_NOT_FOUND":
      return "Клієнта Monobank з цим номером не знайдено. Перевірте, що в броні фінансовий номер Mono.";
    case "EXCEEDED_SUM_LIMIT":
      return "Перевищено ліміт Покупки частинами на цьому акаунті Monobank.";
    case "EXISTS_OTHER_OPEN_ORDER":
      return "У вас уже є незавершена заявка ПЧ. Відхиліть її в Monobank або зачекайте близько 15 хвилин і спробуйте знову. Або оплатіть одразу через MonoPay.";
    case "NOT_ENOUGH_MONEY_FOR_INIT_DEBIT":
      return "Недостатньо коштів для першого платежу ПЧ (≈ 1/3 суми). Поповніть картку або оберіть оплату одразу.";
    case "REJECTED_BY_CLIENT":
      return "Ви відхилили Покупку частинами в Monobank. Оберіть інший спосіб нижче.";
    case "CLIENT_PUSH_TIMEOUT":
      return "Час на підтвердження в Monobank вичерпано. Спробуйте ще раз або оплатіть одразу.";
    case "PAY_PARTS_ARE_NOT_ACCEPTABLE":
      return "Кількість платежів не прийнятна для магазину. Напишіть у підтримку Mono / @chast_monobankbot.";
    case "FRAUD_REJECTED":
    case "RESTRICTED_BY_RISKS":
      return "Банк відхилив заявку через ризик-контроль. Спробуйте інший спосіб оплати або пізніше.";
    default:
      return "Monobank відхилив заявку (часто через іншу відкриту ПЧ або внутрішню помилку банку). Зачекайте ~15 хв або оплатіть одразу через MonoPay.";
  }
}
