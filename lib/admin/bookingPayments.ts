import { normalizeDateToIso, parseSafeDate } from "@/components/admin/desktop/adminDates";
import type { BookingPayment, BookingRecord } from "@/components/admin/desktop/types";
import {
  isAwaitingPaymentStatus,
  isPendingReviewStatus,
} from "@/lib/public-booking/bookingReview";

export type { BookingPayment };

export type PaymentBucket = "prepay" | "surcharge";

export function dateOnly(d: Date | string): Date {
  const x = d instanceof Date ? new Date(d.getTime()) : parseSafeDate(String(d));
  x.setHours(0, 0, 0, 0);
  return x;
}

export function formatDateIso(d: Date | string): string {
  const x = dateOnly(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function isPrepayType(t: string): boolean {
  return t === "prepay" || t === "online" || t === "adjustment";
}

export function isSurchargeType(t: string): boolean {
  return t === "surcharge" || t === "remainder";
}

/** Тип у UI: лише аванс / доплата / повернення (online → аванс). */
export function normalizePaymentTypeForUi(t: string): string {
  if (t === "surcharge" || t === "remainder") return "surcharge";
  if (t === "refund") return "refund";
  return "prepay";
}

export function buildLegacyPayments(b: BookingRecord): BookingPayment[] {
  const prepay = Math.round(Number(b.prepayAmount) || 0);
  const surcharge = Math.round(Number(b.surchargeAmount) || 0);
  const paid = Math.round(Number(b.paidAmount) || 0);
  const isUnpaidSiteBooking =
    String(b.source) === "Сайт" &&
    (isAwaitingPaymentStatus(b.status) || isPendingReviewStatus(b.status));
  const createdRaw = String(b.createdAt || b.checkIn || "");
  const created = normalizeDateToIso(createdRaw) || String(b.checkIn || "");
  const payments: BookingPayment[] = [];

  // For a new site booking prepayAmount is the amount requested, not money received.
  if (prepay > 0 && !isUnpaidSiteBooking) {
    payments.push({
      id: "legacy-p",
      date: created,
      amount: prepay,
      method: String(b.prepayMethod || "ФОП"),
      type: String(b.source) === "Сайт" ? "online" : "prepay",
      note: "",
    });
  }
  if (surcharge > 0) {
    payments.push({
      id: "legacy-s",
      date: String(b.checkOut || created),
      amount: surcharge,
      method: String(b.surchargeMethod || "Готівка"),
      type: "surcharge",
      note: "",
    });
  }
  if (!payments.length && paid > 0 && prepay === 0 && surcharge === 0) {
    payments.push({
      id: "legacy-t",
      date: created,
      amount: paid,
      method: String(b.prepayMethod || "ФОП"),
      type: "prepay",
      note: "",
    });
  }
  return payments;
}

export function getBookingPayments(b: BookingRecord): BookingPayment[] {
  const mapOne = (p: BookingPayment): BookingPayment => ({
    ...p,
    type: normalizePaymentTypeForUi(String(p.type)),
  });
  const raw = b.payments;
  if (Array.isArray(raw) && raw.length) {
    return (raw as BookingPayment[]).map(mapOne);
  }
  return buildLegacyPayments(b).map(mapOne);
}

export function paidUntilDate(b: BookingRecord, asOfDate: Date | string): number {
  const pays = getBookingPayments(b);
  if (!pays.length) return Math.round(Number(b.paidAmount) || 0);
  const asOf = dateOnly(asOfDate);
  return pays
    .filter((p) => dateOnly(p.date) <= asOf)
    .reduce((s, p) => s + (Math.round(Number(p.amount)) || 0), 0);
}

export function paymentsInPeriod(
  b: BookingRecord,
  startDate: Date,
  endDate: Date
): BookingPayment[] {
  const start = dateOnly(startDate);
  const end = dateOnly(endDate);
  return getBookingPayments(b).filter((p) => {
    const d = dateOnly(p.date);
    return d >= start && d <= end;
  });
}

export function sumPaymentsByBucket(
  payments: BookingPayment[],
  bucket: PaymentBucket
): number {
  return (payments || [])
    .filter((p) =>
      bucket === "prepay" ? isPrepayType(p.type) : isSurchargeType(p.type)
    )
    .reduce((s, p) => s + (Math.round(Number(p.amount)) || 0), 0);
}

export function addPaymentMethodBucket(
  bucket: { cash: number; card: number; fop: number },
  amount: unknown,
  method: unknown
): void {
  const amt = Math.round(Number(amount) || 0);
  if (amt <= 0) return;
  const m = String(method || "").trim();
  if (m === "Готівка") bucket.cash += amt;
  else if (m === "Картка") bucket.card += amt;
  else bucket.fop += amt;
}

export type BuildPaymentsForSaveInput = {
  journalPayments: BookingPayment[];
  prepay: number;
  surcharge: number;
  prepayMethod: string;
  surchargeMethod: string;
  createdAt: string;
  checkOut: string;
};

/** Синхронізує поля «Аванс / Доплата» з журналом (дата запису — сьогодні). */
export function mergeTopFieldsIntoJournal(
  payments: BookingPayment[],
  prepay: number,
  surcharge: number,
  prepayMethod: string,
  surchargeMethod: string
): BookingPayment[] {
  const today = formatDateIso(new Date());
  let next = payments.filter((p) => !isPrepayType(p.type) && !isSurchargeType(p.type));

  if (prepay !== 0) {
    const prev = payments.find((p) => isPrepayType(p.type));
    next.push({
      id: prev?.id || `P-${Date.now()}-p`,
      date: today,
      amount: prepay,
      method: prepayMethod,
      type: "prepay",
      note: prev?.note || "",
    });
  }
  if (surcharge !== 0) {
    const prev = payments.find((p) => isSurchargeType(p.type));
    next.push({
      id: prev?.id || `P-${Date.now()}-s`,
      date: today,
      amount: surcharge,
      method: surchargeMethod,
      type: "surcharge",
      note: prev?.note || "",
    });
  }
  return next;
}

export function buildPaymentsForSave(input: BuildPaymentsForSaveInput): BookingPayment[] {
  let payments = input.journalPayments
    .map((p) => ({
      id: p.id,
      date: String(p.date || "").substring(0, 10),
      amount: Math.round(Number(p.amount) || 0),
      method: p.method || "ФОП",
      type: p.type || "prepay",
      note: p.note || "",
    }))
    .filter((p) => p.amount !== 0);

  const journalPrepay = sumPaymentsByBucket(payments, "prepay");
  const journalSurcharge = sumPaymentsByBucket(payments, "surcharge");
  const today = formatDateIso(new Date());

  if (input.prepay !== journalPrepay) {
    payments = payments.filter((p) => !isPrepayType(p.type));
    if (input.prepay !== 0) {
      payments.push({
        id: `P-${Date.now()}-p`,
        date: today,
        amount: input.prepay,
        method: input.prepayMethod,
        type: "prepay",
        note: "",
      });
    }
  }
  if (input.surcharge !== journalSurcharge) {
    payments = payments.filter((p) => !isSurchargeType(p.type));
    if (input.surcharge !== 0) {
      payments.push({
        id: `P-${Date.now()}-s`,
        date: today,
        amount: input.surcharge,
        method: input.surchargeMethod,
        type: "surcharge",
        note: "",
      });
    }
  }
  return payments;
}

export function syncJournalTotals(payments: BookingPayment[]): {
  prepay: number;
  surcharge: number;
  prepayMethod: string;
  surchargeMethod: string;
  paidAmount: number;
} {
  const prepay = sumPaymentsByBucket(payments, "prepay");
  const surcharge = sumPaymentsByBucket(payments, "surcharge");
  const lastPrepay = [...payments]
    .reverse()
    .find((p) => isPrepayType(p.type) && Number(p.amount) > 0);
  const lastSurcharge = [...payments]
    .reverse()
    .find((p) => isSurchargeType(p.type) && Number(p.amount) > 0);
  const paidAmount = payments.reduce(
    (s, p) => s + (Math.round(Number(p.amount)) || 0),
    0
  );
  return {
    prepay,
    surcharge,
    prepayMethod: lastPrepay?.method || "ФОП",
    surchargeMethod: lastSurcharge?.method || "Готівка",
    paidAmount,
  };
}

/** Сума всіх платежів з журналу (або legacy paidAmount). */
export function resolveBookingPaidTotal(b: BookingRecord): number {
  if (isPendingReviewStatus(b.status)) return 0;
  const payments = getBookingPayments(b);
  if (payments.length) {
    return payments.reduce((s, p) => s + (Math.round(Number(p.amount)) || 0), 0);
  }
  return Math.round(Number(b.paidAmount) || 0);
}

export function resolveBookingPrepayPaid(b: BookingRecord): number {
  return sumPaymentsByBucket(getBookingPayments(b), "prepay");
}

export function resolveBookingExpectedPrepay(b: BookingRecord, total?: number): number {
  const bookingTotal = total ?? Math.round(Number(b.totalPrice) || 0);
  const fromField = Math.round(Number(b.prepayAmount) || 0);
  if (fromField > 0) return fromField;
  if (bookingTotal > 0) return Math.round(bookingTotal / 2);
  return 0;
}

export type BookingFinanceSummary = {
  total: number;
  paid: number;
  balance: number;
  prepayExpected: number;
  prepayPaid: number;
};

export function resolveBookingFinanceSummary(b: BookingRecord): BookingFinanceSummary {
  const total = Math.round(Number(b.totalPrice) || 0);
  const paid = resolveBookingPaidTotal(b);
  const prepayPaid = resolveBookingPrepayPaid(b);
  const prepayExpected = resolveBookingExpectedPrepay(b, total);
  return {
    total,
    paid,
    balance: total - paid,
    prepayExpected,
    prepayPaid,
  };
}
