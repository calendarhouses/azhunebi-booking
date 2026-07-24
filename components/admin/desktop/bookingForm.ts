import { getAdminTenantId } from "./adminApi";
import { normalizeDateToIso } from "./adminDates";
import { nightWord } from "./adminPlural";
import type { BookingRecord } from "./types";
import {
  buildPaymentsForSave,
  sumPaymentsByBucket,
} from "@/lib/admin/bookingPayments";
import { buildSpecialTariffCommentParts } from "@/lib/admin/specialTariffBooking";
import type { SpecialTariffToggle } from "@/lib/admin/specialTariffBooking";
import {
  buildChildrenCommentToken,
  buildServiceCommentTokens,
  type ServiceSelectionMap,
} from "./settings/additionalServicesLogic";
import { buildEarlyCommentToken, buildLateCommentToken } from "@/lib/admin/flexibleSchedule";
import { buildPromoCodeCommentToken } from "@/lib/admin/bookingDiscountCalc";
import {
  BOOKING_STATUS_CLOSED,
  isClosedStatus,
} from "@/lib/public-booking/bookingReview";

export function getFormVal(id: string): number {
  const el = document.getElementById(id);
  if (!el) return 0;
  const val = el.tagName === "INPUT" ? (el as HTMLInputElement).value : el.innerText;
  return Number(String(val).replace(/\s/g, "")) || 0;
}

export function getFormString(id: string): string {
  const el = document.getElementById(id) as HTMLInputElement | null;
  return el?.value?.trim() ?? "";
}

export function buildSystemComment(
  rawComment: string,
  opts: {
    children: number;
    youngestChildAge?: number | null;
    selectedServices: ServiceSelectionMap;
    dayGuests: number;
    vat: string;
    specialTariffs: Record<string, "Так" | "Ні">;
    specialTariffToggles: SpecialTariffToggle[];
    promoCode?: string;
    earlyTime: string | null;
    lateTime: string | null;
    /** Зберегти імпортні BookMeNow-токени при перезаписі коментаря. */
    bookmenowTokens?: string[];
  }
): string {
  const sysComment: string[] = [];
  const childrenToken = buildChildrenCommentToken(
    opts.children,
    opts.children > 0 ? opts.youngestChildAge ?? null : null
  );
  if (childrenToken) sysComment.push(childrenToken);
  sysComment.push(...buildServiceCommentTokens(opts.selectedServices));
  if (opts.dayGuests > 0) sysComment.push(`👥 Денні гості: ${opts.dayGuests}`);
  if (opts.vat === "Так") sysComment.push("♨️ Чан: Так");
  sysComment.push(...buildSpecialTariffCommentParts(opts.specialTariffs, opts.specialTariffToggles));
  const promoToken = buildPromoCodeCommentToken(opts.promoCode || "");
  if (promoToken) sysComment.push(promoToken);
  if (opts.earlyTime) sysComment.push(buildEarlyCommentToken(opts.earlyTime, false));
  if (opts.lateTime) sysComment.push(buildLateCommentToken(opts.lateTime, false));
  for (const token of opts.bookmenowTokens || []) {
    const t = String(token || "").trim();
    if (t && !sysComment.includes(t)) sysComment.push(t);
  }

  if (sysComment.length > 0) {
    return (
      sysComment.join(" | ") +
      (rawComment ? `\n\nКоментар гостя: ${rawComment}` : "")
    );
  }
  return rawComment;
}

export function collectBookingFromForm(
  editingRowNumber: number | string | null,
  selectedEarlyTime: string | null,
  selectedLateTime: string | null,
  formDates?: { checkIn?: string; checkOut?: string }
): Record<string, unknown> {
  const statusBtn = document.querySelector(".status-btn.active");
  const status = statusBtn?.getAttribute("data-status") || "Очікує оплату";

  const prepay = getFormVal("adminPrepayAmount");
  const surcharge = getFormVal("adminSurchargeAmount");
  const prepayMethod = getFormString("adminPrepayMethod") || "ФОП";
  const surchargeMethod = getFormString("adminSurchargeMethod") || "Готівка";

  const w = window as Window & {
    _bookingPayments?: Array<{
      id: string;
      date: string;
      amount: number;
      method: string;
      type: string;
      note?: string;
    }>;
    _bookingPaymentMeta?: { createdAt?: string; checkOut?: string };
    _bookingExpectedPrepay?: number;
    _bookingAssignmentState?: "assigned" | "holding";
    _bookingBookmenowCommentTokens?: string[];
  };
  const paymentsForSave = buildPaymentsForSave({
    journalPayments: w._bookingPayments || [],
    prepay,
    surcharge,
    prepayMethod,
    surchargeMethod,
    createdAt:
      w._bookingPaymentMeta?.createdAt ||
      normalizeDateToIso(formDates?.checkIn || getFormString("adminCheckIn")),
    checkOut: normalizeDateToIso(
      w._bookingPaymentMeta?.checkOut || formDates?.checkOut || getFormString("adminCheckOut")
    ),
  });
  const actualPrepay = sumPaymentsByBucket(paymentsForSave, "prepay");
  const actualPaid = paymentsForSave.reduce(
    (sum, payment) => sum + (Number(payment.amount) || 0),
    0
  );
  const source = getFormString("adminSource");
  const preserveExpectedPrepay =
    source === "Сайт" &&
    status === "Очікує оплату" &&
    actualPaid === 0;

  const rawName = getFormString("adminName");
  const rawPhone = getFormString("adminPhone");
  const closed = isClosedStatus(status);
  const guestName =
    rawName || (closed ? BOOKING_STATUS_CLOSED : "");
  const guestPhone =
    rawPhone || (closed ? "Не вказано" : "");

  const bookingData: Record<string, unknown> = {
    tenant_id: getAdminTenantId(),
    checkIn: normalizeDateToIso(
      formDates?.checkIn || getFormString("adminCheckIn")
    ),
    checkOut: normalizeDateToIso(
      formDates?.checkOut || getFormString("adminCheckOut")
    ),
    cottage: (() => {
      const rawCottage = getFormString("adminCottage");
      const rawRoomId = getFormString("adminRoomId");
      const rooms =
        (typeof window !== "undefined" &&
          (window as Window & { roomsList?: Array<{ id?: number | string; name?: string; short?: string }> })
            .roomsList) ||
        [];
      if (rawRoomId && rooms.length) {
        const room = rooms.find((r) => String(r.id) === String(rawRoomId));
        if (room) {
          const short = String(room.short || "").trim();
          const name = String(room.name || "").trim();
          return short || name || rawCottage;
        }
      }
      return rawCottage;
    })(),
    roomId: (() => {
      const raw = getFormString("adminRoomId");
      if (!raw) return undefined;
      const asNum = Number(raw);
      return Number.isFinite(asNum) ? asNum : raw;
    })(),
    name: guestName,
    phone: guestPhone,
    guests: getFormString("adminGuests"),
    pets: getFormString("adminPets"),
    source,
    assignmentState: w._bookingAssignmentState || "assigned",
    status,
    totalPrice: getFormVal("adminTotalPrice"),
    prepayAmount: preserveExpectedPrepay
      ? Number(w._bookingExpectedPrepay) || 0
      : actualPrepay,
    prepayMethod,
    surchargeAmount: sumPaymentsByBucket(paymentsForSave, "surcharge"),
    surchargeMethod,
    paidAmount: actualPaid,
    payments: paymentsForSave,
    comment: buildSystemComment(getFormString("adminComment"), {
      children: parseInt(getFormString("adminChildren"), 10) || 0,
      youngestChildAge: parseInt(getFormString("adminYoungestChildAge"), 10) || null,
      selectedServices: readSelectedServicesFromDom(),
      dayGuests: parseInt(getFormString("adminDayGuests"), 10) || 0,
      vat: getFormString("adminVat"),
      specialTariffs: readSpecialTariffsFromDom(),
      promoCode: getFormString("adminPromoCode"),
      specialTariffToggles:
        (window as Window & { __bookingSpecialTariffToggles?: SpecialTariffToggle[] })
          .__bookingSpecialTariffToggles || [],
      earlyTime: selectedEarlyTime,
      lateTime: selectedLateTime,
      bookmenowTokens: w._bookingBookmenowCommentTokens || [],
    }),
    basePrice: getFormVal("manualBasePrice"),
    extraGuestFee: getFormVal("manualExtraGuest"),
    petFee: getFormVal("manualPet"),
    dayGuestFee: getFormVal("manualDayGuest"),
    earlyFee: getFormVal("manualEarly"),
    lateFee: getFormVal("manualLate"),
    discountAmount: getFormVal("manualDiscount"),
    custom_color: (() => {
      const raw = getFormString("adminCustomColor").trim();
      return raw || "";
    })(),
  };

  if (editingRowNumber !== null && editingRowNumber !== undefined) {
    const editingKey = String(editingRowNumber).trim();
    if (!editingKey) {
      // no-op
    } else if (/^\d+$/.test(editingKey)) {
      // Legacy: sheet row index
      bookingData.row = Number(editingKey);
    } else {
      // Display id: A-…, B-…, BMN-… тощо
      bookingData.id = editingKey;
    }
  }

  return bookingData;
}

function readSelectedServicesFromDom(): Record<string, number> {
  if (typeof document === "undefined") return {};
  const state: Record<string, number> = {};
  document.querySelectorAll<HTMLInputElement>(".admin-service-input").forEach((el) => {
    const id = el.dataset.serviceId;
    if (!id) return;
    state[id] = Math.max(0, parseInt(el.value, 10) || 0);
  });
  return state;
}

function readSpecialTariffsFromDom(): Record<string, "Так" | "Ні"> {
  if (typeof document === "undefined") return {};
  const state: Record<string, "Так" | "Ні"> = {};
  document.querySelectorAll<HTMLInputElement>(".admin-special-tariff-input").forEach((el) => {
    const id = el.dataset.specialTariffId;
    if (!id) return;
    state[id] = el.value === "Так" ? "Так" : "Ні";
  });
  return state;
}

export function buildPayloadForServer(
  bookingData: Record<string, unknown>,
  editingRowNumber: number | string | null
): Record<string, unknown> {
  const payload = { ...bookingData };

  if (editingRowNumber) {
    const openPay = (window as Window & { _bookingOpenPayments?: { prepay: number; surcharge: number } })
      ._bookingOpenPayments || { prepay: 0, surcharge: 0 };
    const newSurcharge = Number(bookingData.surchargeAmount) || 0;
    const surchargeDelta = newSurcharge - (Number(openPay.surcharge) || 0);
    if (surchargeDelta > 0) {
      payload.remainderPaymentAdded = true;
      payload.remainderPaymentAmount = surchargeDelta;
    }
  }

  return payload;
}

export async function attachScreenshotsToPayload(
  _payload: Record<string, unknown>,
  _bookingData: Record<string, unknown>
): Promise<void> {
  // Telegram notifications are text-only (except finance report screenshots).
  // Skip html2canvas cards to avoid large GAS payloads / mobile CPU cost.
  return;
}

export function handleSaveApiErrors(
  json: { error?: string; requiredMin?: number; success?: boolean }
): void {
  if (json.success !== false && !json.error) return;
  if (json.error === "OVERLAP") {
    alert("❌ ПОМИЛКА: Ці дати щойно були зайняті.");
  } else if (json.error === "MIN_STAY") {
    alert(
      `❌ Сервер відхилив збереження: мінімум ${json.requiredMin || "?"} ${nightWord(json.requiredMin || 2)}.`
    );
  } else if (json.error === "INVALID_DATES") {
    alert("❌ Оберіть дату заїзду та виїзду.");
  } else if (json.error === "DB_ERROR") {
    alert("❌ Не вдалося зберегти в базу. Перевірте дати та спробуйте ще раз.");
  } else if (json.error === "MISSING_TENANT") {
    alert("❌ Не визначено комплекс. Перезавантажте сторінку та увійдіть знову.");
  } else if (json.error) {
    alert(`❌ Помилка збереження: ${json.error}`);
  }
}

export function isBookingSaveSuccessful(
  json: { error?: string; success?: boolean }
): boolean {
  return !json.error && json.success !== false;
}

export function buildBookingRecordFromSave(
  bookingData: Record<string, unknown>,
  saveResult: { orderId?: string },
  existingBookings: BookingRecord[],
  editingRowNumber: number | string | null
): BookingRecord {
  const editingKey =
    editingRowNumber != null ? String(editingRowNumber).trim() : "";
  const existing: BookingRecord | undefined =
    editingKey
      ? existingBookings.find((b) => String(b.id) === editingKey) ??
        existingBookings.find((b) => String(b.row) === editingKey)
      : undefined;

  const id =
    (saveResult.orderId && String(saveResult.orderId).trim()) ||
    (bookingData.id != null && String(bookingData.id).trim()) ||
    (existing?.id != null && String(existing.id).trim()) ||
    `temp-${Date.now()}`;

  let row: number | string;
  if (existing?.row != null) {
    row = existing.row;
  } else if (bookingData.row != null) {
    row = bookingData.row as number | string;
  } else {
    const maxRow = existingBookings.reduce((max, b) => {
      const n = Number(b.row);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    row = maxRow + 1;
  }

  return {
    row,
    id,
    checkIn: String(bookingData.checkIn || ""),
    checkOut: String(bookingData.checkOut || ""),
    cottage: String(bookingData.cottage || ""),
    roomId: bookingData.roomId as number | string | undefined,
    assignmentState:
      bookingData.assignmentState === "holding" ? "holding" : "assigned",
    status: String(bookingData.status || "Очікує оплату"),
    name: String(bookingData.name || ""),
    phone: String(bookingData.phone || ""),
    guests: (() => {
      const raw = bookingData.guests;
      if (raw == null || raw === "") return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    })(),
    pets: bookingData.pets as string | boolean | undefined,
    totalPrice: bookingData.totalPrice as number | string | undefined,
    paidAmount: bookingData.paidAmount as number | string | undefined,
    source: String(bookingData.source || "Адмінка"),
    comment: String(bookingData.comment || ""),
    extraGuestFee: bookingData.extraGuestFee as number | string | undefined,
    petFee: bookingData.petFee as number | string | undefined,
    dayGuestFee: bookingData.dayGuestFee as number | string | undefined,
    earlyFee: bookingData.earlyFee as number | string | undefined,
    lateFee: bookingData.lateFee as number | string | undefined,
    basePrice: bookingData.basePrice as number | string | undefined,
    discountAmount: bookingData.discountAmount as number | string | undefined,
    prepayAmount: bookingData.prepayAmount as number | string | undefined,
    prepayMethod: String(bookingData.prepayMethod || ""),
    surchargeAmount: bookingData.surchargeAmount as number | string | undefined,
    surchargeMethod: String(bookingData.surchargeMethod || ""),
    payments: Array.isArray(bookingData.payments)
      ? (bookingData.payments as BookingRecord["payments"])
      : undefined,
    createdAt: existing?.createdAt || new Date().toISOString(),
    custom_color: (() => {
      const raw = bookingData.custom_color;
      if (raw == null) return existing?.custom_color ?? "";
      return String(raw).trim();
    })(),
  };
}
