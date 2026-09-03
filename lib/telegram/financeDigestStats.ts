import {
  addPaymentMethodBucket,
  getBookingPayments,
} from "@/lib/admin/bookingPayments";
import {
  isAwaitingPaymentStatus,
  isClosedStatus,
  isPendingReviewStatus,
} from "@/lib/public-booking/bookingReview";
import type { BookingRecord } from "@/components/admin/desktop/types";
import { bookingCreatedDateKey, toDateKeyKyiv } from "./formatters";

/**
 * Bookings that count as «нові» in Telegram digests.
 * Must match what appears in the bookings thread: real confirmed/paid stays,
 * not unpaid site attempts, room blocks, iCal, or holding.
 */
export function isActiveFinanceBooking(b: BookingRecord): boolean {
  const status = String(b.status || "");
  if (status.toLowerCase().includes("скас")) return false;
  if (status.toLowerCase().includes("нова")) return false;
  if (isAwaitingPaymentStatus(status)) return false;
  if (isPendingReviewStatus(status)) return false;
  if (isClosedStatus(status)) return false;
  if (b.assignmentState === "holding") return false;
  const id = String(b.id || "").trim();
  if (id.startsWith("ICAL-")) return false;
  return true;
}

/** Payment calendar day in Kyiv (prefers `date`, else `at`). */
export function paymentDateKey(payment: {
  date?: unknown;
  at?: unknown;
}): string {
  const rawDate = String(payment.date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) return rawDate.slice(0, 10);
  if (payment.at) return toDateKeyKyiv(String(payment.at));
  return "";
}

/**
 * MonoPay / online acquiring → Картка for digest buckets
 * (same three columns as the finance Telegram report).
 */
export function digestPaymentMethod(method: unknown): string {
  const m = String(method || "").trim();
  const lower = m.toLowerCase();
  if (lower === "готівка") return "Готівка";
  if (lower === "картка" || lower.includes("mono")) return "Картка";
  return m || "ФОП";
}

/** Real creation day in [startKey, endKey] (Kyiv date keys). */
export function countBookingsCreatedInRange(
  bookings: BookingRecord[],
  startKey: string,
  endKey: string
): number {
  let count = 0;
  for (const b of bookings) {
    if (!isActiveFinanceBooking(b)) continue;
    const created = bookingCreatedDateKey(b);
    if (!created || created < startKey || created > endKey) continue;
    count += 1;
  }
  return count;
}

/**
 * Money received in period from bookings that were also created in that period.
 *
 * Evening / week / month sit next to «Нових бронювань», so we must not mix in
 * checkout remainders from older stays (that inflated August to ~1M ₴).
 * Also skips unpaid expected prepays and the old check-in fallback.
 */
export function sumFinancePaymentsInRange(
  bookings: BookingRecord[],
  startKey: string,
  endKey: string
): { cash: number; card: number; fop: number } {
  const payments = { cash: 0, card: 0, fop: 0 };

  for (const b of bookings) {
    if (!isActiveFinanceBooking(b)) continue;
    const created = bookingCreatedDateKey(b);
    if (!created || created < startKey || created > endKey) continue;

    for (const p of getBookingPayments(b)) {
      const amt = Math.round(Number(p.amount) || 0);
      if (amt <= 0) continue;
      const day = paymentDateKey(p);
      if (!day || day < startKey || day > endKey) continue;
      addPaymentMethodBucket(payments, amt, digestPaymentMethod(p.method));
    }
  }

  return payments;
}

/** Expenses + manual income lines from settings.transactions (admin parity). */
export function sumManualTransactionsInRange(
  transactions: Array<Record<string, unknown>> | undefined,
  startKey: string,
  endKey: string
): { manualIncome: number; totalExpense: number } {
  let manualIncome = 0;
  let totalExpense = 0;
  for (const tr of transactions || []) {
    const tDate = String(tr.date || "").slice(0, 10);
    if (!tDate || tDate < startKey || tDate > endKey) continue;
    const amt = Math.round(Number(tr.amount) || 0);
    if (amt <= 0) continue;
    if (tr.type === "income") manualIncome += amt;
    else if (tr.type === "expense") totalExpense += amt;
  }
  return { manualIncome, totalExpense };
}

export function buildFinancePeriodStats(
  bookings: BookingRecord[],
  transactions: Array<Record<string, unknown>> | undefined,
  startKey: string,
  endKey: string
): {
  bookingsCount: number;
  totalIncome: number;
  totalExpense: number;
  profit: number;
  payments: { cash: number; card: number; fop: number };
} {
  const payments = sumFinancePaymentsInRange(bookings, startKey, endKey);
  const bookingIncome = payments.cash + payments.card + payments.fop;
  const { manualIncome, totalExpense } = sumManualTransactionsInRange(
    transactions,
    startKey,
    endKey
  );
  const totalIncome = bookingIncome + manualIncome;
  return {
    bookingsCount: countBookingsCreatedInRange(bookings, startKey, endKey),
    totalIncome,
    totalExpense,
    profit: totalIncome - totalExpense,
    payments,
  };
}

/** Debug helper: ensure journal normalization sees `at` ISO timestamps. */
export function bookingHasPaymentJournal(b: BookingRecord): boolean {
  return getBookingPayments(b).length > 0;
}
