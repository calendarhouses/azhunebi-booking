import { parseSafeDate } from "@/components/admin/desktop/adminDates";
import {
  addPaymentMethodBucket,
  getBookingPayments,
  paymentsInPeriod,
} from "@/lib/admin/bookingPayments";
import { isBookingCheckInInPeriod } from "@/components/admin/desktop/reports/reportPeriod";
import type { BookingRecord } from "@/components/admin/desktop/types";
import { bookingCreatedDateKey } from "./formatters";

/** Bookings that should appear in finance digests (evening / week / month). */
export function isActiveFinanceBooking(b: BookingRecord): boolean {
  const status = String(b.status || "").toLowerCase();
  if (status.includes("скас")) return false;
  if (status.includes("нова")) return false;
  if (b.assignmentState === "holding") return false;
  const id = String(b.id || "").trim();
  if (id.startsWith("ICAL-")) return false;
  return true;
}

function periodBounds(startKey: string, endKey: string): { startDate: Date; endDate: Date } {
  const startDate = parseSafeDate(startKey);
  startDate.setHours(0, 0, 0, 0);
  const endDate = parseSafeDate(endKey);
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
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
 * Cash received in period — same rules as admin «Звіти» (gatherFinanceReport):
 * journal payments dated in range, else legacy paid fields only when check-in is in range.
 */
export function sumFinancePaymentsInRange(
  bookings: BookingRecord[],
  startKey: string,
  endKey: string
): { cash: number; card: number; fop: number } {
  const { startDate, endDate } = periodBounds(startKey, endKey);
  const payments = { cash: 0, card: 0, fop: 0 };

  for (const b of bookings) {
    if (String(b.status || "").toLowerCase().includes("скас")) continue;

    const periodPays = paymentsInPeriod(b, startDate, endDate);
    if (periodPays.length > 0) {
      for (const p of periodPays) {
        const amt = Math.round(Number(p.amount) || 0);
        if (amt === 0) continue;
        if (amt > 0) addPaymentMethodBucket(payments, amt, p.method);
      }
      continue;
    }

    if (!isBookingCheckInInPeriod(String(b.checkIn || ""), startDate, endDate)) continue;

    const prepay = Math.round(Number(b.prepayAmount) || 0);
    const surcharge = Math.round(Number(b.surchargeAmount) || 0);
    if (prepay > 0) addPaymentMethodBucket(payments, prepay, b.prepayMethod || "ФОП");
    if (surcharge > 0) addPaymentMethodBucket(payments, surcharge, b.surchargeMethod || "Готівка");
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
