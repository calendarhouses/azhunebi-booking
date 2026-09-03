import { normalizeDateToIso, parseSafeDate } from "@/components/admin/desktop/adminDates";
import type { BookingPayment, BookingRecord } from "@/components/admin/desktop/types";
import {
  isAwaitingPaymentStatus,
  isPendingReviewStatus,
} from "@/lib/public-booking/bookingReview";
import {
  buildStayNightlyBasePrices,
  calculatePrepaymentAmount,
  readPrepaymentPolicy,
  type PrepaymentPolicy,
} from "@/lib/public-booking/prepaymentPolicy";
import type { PublicBranding } from "@/lib/public-booking/types";

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
  const awaitingUnpaid =
    isAwaitingPaymentStatus(b.status) || isPendingReviewStatus(b.status);
  const createdRaw = String(b.createdAt || b.checkIn || "");
  const created = normalizeDateToIso(createdRaw) || String(b.checkIn || "");
  const payments: BookingPayment[] = [];

  // prepayAmount on an unpaid booking is the amount requested, not money received.
  if (prepay > 0 && !awaitingUnpaid) {
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
    const fallbackDate =
      normalizeDateToIso(String(b.createdAt || "")) ||
      String(b.checkIn || "").substring(0, 10);
    const normalized = (raw as unknown as Array<Record<string, unknown>>).map((p): BookingPayment => {
      const rawDate = String(p.date || p.at || "").substring(0, 10);
      const date = rawDate && !isNaN(new Date(rawDate).getTime()) ? rawDate : fallbackDate;
      const method = String(p.method || (p.provider === "mono" ? "ФОП" : p.provider) || "ФОП");
      const type = String(p.type || (p.provider ? "online" : "prepay"));
      return {
        id: String(p.id || `pay-${date}-${Number(p.amount) || 0}`),
        date,
        amount: Math.round(Number(p.amount) || 0),
        method,
        type,
        note: String(p.note || ""),
      };
    });
    return normalized.map(mapOne);
  }
  return buildLegacyPayments(b).map(mapOne);
}

export function paidUntilDate(b: BookingRecord, asOfDate: Date | string): number {
  const legacyPaid = Math.round(Number(b.paidAmount) || 0);
  const pays = getBookingPayments(b);
  if (!pays.length) return legacyPaid;
  const asOf = dateOnly(asOfDate);
  const journalSum = pays
    .filter((p) => dateOnly(p.date) <= asOf)
    .reduce((s, p) => s + (Math.round(Number(p.amount)) || 0), 0);
  return Math.max(journalSum, legacyPaid);
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

/** Очікувана передплата: збережене поле броні → політика брендингу → 50%.
 *  Якщо ще нічого не сплачено і є політика — беремо її (щоб не тягнути застарілі 50%).
 *  Для mode=nights — сума перших N ночей з тарифу, не середнє. */
export function resolveBookingExpectedPrepay(
  b: BookingRecord,
  total?: number,
  opts?: {
    policy?: PrepaymentPolicy;
    basePriceTotal?: number;
    nights?: number;
    nightlyBasePrices?: number[];
  }
): number {
  const bookingTotal = total ?? Math.round(Number(b.totalPrice) || 0);
  const fromField = Math.round(Number(b.prepayAmount) || 0);
  const paidSoFar = resolveBookingPaidTotal(b);

  const fromPolicy = (): number => {
    if (!opts?.policy) return 0;
    const checkIn = parseSafeDate(String(b.checkIn || ""));
    const checkOut = parseSafeDate(String(b.checkOut || ""));
    const nightsFromDates =
      !isNaN(checkIn.getTime()) && !isNaN(checkOut.getTime())
        ? Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000))
        : 1;
    const nights = opts.nights && opts.nights > 0 ? opts.nights : nightsFromDates;
    const basePriceTotal =
      opts.basePriceTotal != null && opts.basePriceTotal > 0
        ? opts.basePriceTotal
        : Math.round(Number(b.basePrice) || bookingTotal);
    return calculatePrepaymentAmount(opts.policy, {
      totalPrice: bookingTotal,
      basePriceTotal,
      nights,
      nightlyBasePrices: opts.nightlyBasePrices,
    });
  };

  if (opts?.policy && paidSoFar === 0) {
    // Explicit policy wins for unpaid bookings (incl. 0 = без передплати).
    return fromPolicy();
  }
  if (fromField > 0) return fromField;
  if (opts?.policy) return fromPolicy();
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

function readBrandingPolicyFromWindow(): PrepaymentPolicy | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & {
    branding?: PublicBranding;
  };
  if (!w.branding) return undefined;
  return readPrepaymentPolicy(w.branding);
}

function nightlyBasePricesForBookingFromWindow(b: BookingRecord): number[] | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & {
    roomsList?: Array<{
      id?: number | string;
      name?: string;
      short?: string;
      priceWeekday?: number;
      priceWeekend?: number;
      priceOneNightWeekday?: number;
      priceOneNightWeekend?: number;
      weekendDays?: number[];
    }>;
    customPrices?: Record<string, Record<string, number>>;
  };
  const rooms = w.roomsList || [];
  const roomId = b.roomId;
  const cottage = String(b.cottage || "");
  const room =
    (roomId != null
      ? rooms.find((r) => String(r.id) === String(roomId))
      : undefined) ||
    rooms.find(
      (r) =>
        cottage &&
        (String(r.name || "") === cottage ||
          String(r.short || "") === cottage ||
          cottage.includes(String(r.name || "")) ||
          cottage.includes(String(r.short || "")))
    );
  if (!room) return undefined;
  const checkIn = parseSafeDate(String(b.checkIn || ""));
  const checkOut = parseSafeDate(String(b.checkOut || ""));
  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) return undefined;
  const nights = Math.max(
    1,
    Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000)
  );
  return buildStayNightlyBasePrices({
    checkIn,
    nights,
    priceWeekday: Number(room.priceWeekday) || 0,
    priceWeekend: Number(room.priceWeekend) || 0,
    priceOneNightWeekday: room.priceOneNightWeekday,
    priceOneNightWeekend: room.priceOneNightWeekend,
    weekendDays: room.weekendDays,
    roomId: room.id,
    customPrices: w.customPrices || null,
  });
}

export function resolveBookingFinanceSummary(b: BookingRecord): BookingFinanceSummary {
  const total = Math.round(Number(b.totalPrice) || 0);
  const paid = resolveBookingPaidTotal(b);
  const prepayPaid = resolveBookingPrepayPaid(b);
  const policy = readBrandingPolicyFromWindow();
  const prepayExpected = resolveBookingExpectedPrepay(
    b,
    total,
    policy
      ? {
          policy,
          basePriceTotal: Math.round(Number(b.basePrice) || 0) || undefined,
          nightlyBasePrices: nightlyBasePricesForBookingFromWindow(b),
        }
      : undefined
  );
  return {
    total,
    paid,
    balance: total - paid,
    prepayExpected,
    prepayPaid,
  };
}
