import { parseSafeDate } from "../adminDates";
import { calculateAccrualBalances } from "@/lib/admin/accrualBalances";
import {
  addPaymentMethodBucket,
  paidUntilDate,
  paymentsInPeriod,
} from "@/lib/admin/bookingPayments";
import { findRoomForBooking } from "../bookingUtils";
import type {
  BookingRecord,
  CustomServiceConfig,
  RoomConfig,
  TransactionConfig,
} from "../types";
import {
  formatFinanceReportPeriodDisplay,
  getReportPeriodDates,
  isBookingCheckInInPeriod,
} from "./reportPeriod";
import { attributeBookingServiceFees } from "./serviceFeeAttribution";
import type { FinanceReport, ReportPeriod } from "./types";

export type GatherFinanceReportInput = {
  bookings: BookingRecord[];
  transactions: TransactionConfig[];
  roomsList?: RoomConfig[];
  customServicesList?: CustomServiceConfig[];
  period: ReportPeriod;
  periodLabel: string;
  customRange?: { start: Date; end: Date } | null;
};

export function gatherFinanceReport(input: GatherFinanceReportInput): FinanceReport {
  const {
    bookings,
    transactions,
    roomsList = [],
    customServicesList = [],
    period,
    periodLabel,
    customRange,
  } = input;
  const { startDate, endDate } = getReportPeriodDates(period, periodLabel, customRange);
  const periodDisplay = formatFinanceReportPeriodDisplay(period, periodLabel, startDate, endDate);

  const breakdown = {
    base: 0,
    guests: 0,
    pets: 0,
    earlyLate: 0,
    services: {} as Record<string, number>,
  };
  const serviceNames: Record<string, string> = {};
  customServicesList.forEach((s) => {
    serviceNames[String(s.id)] = s.name || `Послуга ${s.id}`;
  });
  const payments = { cash: 0, card: 0, fop: 0 };
  let bookingsCount = 0;
  let bookingIncome = 0;
  let cashInflow = 0;

  (bookings || []).forEach((b) => {
    if (String(b.status).toLowerCase().includes("скас")) return;
    if (isBookingCheckInInPeriod(String(b.checkIn), startDate, endDate)) bookingsCount++;
  });

  (bookings || []).forEach((b) => {
    if (String(b.status).toLowerCase().includes("скас")) return;
    const periodPays = paymentsInPeriod(b, startDate, endDate);
    if (periodPays.length) {
      periodPays.forEach((p) => {
        const amt = Math.round(Number(p.amount) || 0);
        if (amt === 0) return;
        cashInflow += amt;
        if (amt > 0) addPaymentMethodBucket(payments, amt, p.method);
      });
      return;
    }
    if (!isBookingCheckInInPeriod(String(b.checkIn), startDate, endDate)) return;
    const pAmt = Math.round(Number(b.paidAmount) || 0);
    const sAmt = Math.round(Number(b.surchargeAmount) || 0);
    if (pAmt > 0) {
      cashInflow += pAmt;
      addPaymentMethodBucket(payments, pAmt, b.prepayMethod || "ФОП");
    }
    if (sAmt > 0) {
      cashInflow += sAmt;
      addPaymentMethodBucket(payments, sAmt, b.surchargeMethod || "Готівка");
    }
  });

  (bookings || []).forEach((b) => {
    if (String(b.status).toLowerCase().includes("скас")) return;
    if (!isBookingCheckInInPeriod(String(b.checkIn), startDate, endDate)) return;

    const price = Number(b.totalPrice) || 0;
    void paidUntilDate(b, endDate);
    const periodPays = paymentsInPeriod(b, startDate, endDate);

    periodPays.forEach((p) => {
      const pAmt = Math.round(Number(p.amount) || 0);
      if (pAmt <= 0) return;
      bookingIncome += pAmt;
    });

    if (periodPays.length === 0) {
      const pAmt = Number(b.paidAmount) || 0;
      if (pAmt > 0) bookingIncome += Math.round(pAmt);
      const sAmt = Number(b.surchargeAmount) || 0;
      if (sAmt > 0) bookingIncome += Math.round(sAmt);
    }

    let periodPaidSum = periodPays.reduce(
      (s, p) => s + (Math.round(Number(p.amount)) || 0),
      0
    );
    if (periodPays.length === 0) {
      periodPaidSum =
        Math.round(Number(b.paidAmount) || 0) +
        Math.round(Number(b.surchargeAmount) || 0);
    }

    if (periodPaidSum > 0) {
      const inD = parseSafeDate(String(b.checkIn));
      const outD = parseSafeDate(String(b.checkOut));
      const nights = Math.max(1, Math.round((outD.getTime() - inD.getTime()) / 86400000));
      const room = findRoomForBooking(b, roomsList);
      const cap = room ? room.capacity : 2;
      const extraPrice =
        room && room.extraGuestPrice !== undefined ? room.extraGuestPrice : 2500;
      const extraGuests = Math.max(0, (parseInt(String(b.guests), 10) || 2) - cap);
      const feeGuests =
        b.extraGuestFee !== undefined && b.extraGuestFee !== ""
          ? Number(b.extraGuestFee)
          : extraGuests * extraPrice * nights;
      const feePets =
        b.petFee !== undefined && b.petFee !== ""
          ? Number(b.petFee)
          : b.pets === "Так" || b.pets === true
            ? 500 + 200 * nights
            : 0;
      const feeEarlyLate = (Number(b.earlyFee) || 0) + (Number(b.lateFee) || 0);
      const { lines, leftoverOther } = attributeBookingServiceFees({
        booking: b,
        services: customServicesList,
        nights,
      });
      const ratio = price > 0 ? periodPaidSum / price : 1;
      breakdown.pets += Math.round(feePets * ratio);
      breakdown.guests += Math.round(feeGuests * ratio);
      breakdown.earlyLate += Math.round(feeEarlyLate * ratio);
      let servicesPaid = 0;
      for (const line of lines) {
        const part = Math.round(line.amount * ratio);
        breakdown.services[line.id] = (breakdown.services[line.id] || 0) + part;
        serviceNames[line.id] = line.name;
        servicesPaid += part;
      }
      const leftoverPaid = Math.round(leftoverOther * ratio);
      breakdown.base += Math.round(
        periodPaidSum -
          feePets * ratio -
          feeGuests * ratio -
          feeEarlyLate * ratio -
          servicesPaid -
          leftoverPaid
      );
    }
  });

  const incomeLines: FinanceReport["incomeLines"] = [];
  if (breakdown.base > 0)
    incomeLines.push({ title: "Оренда котеджів", amount: breakdown.base, sub: "Заїзди періоду" });
  if (breakdown.guests > 0)
    incomeLines.push({ title: "Додаткові гості", amount: breakdown.guests, sub: "" });
  if (breakdown.pets > 0)
    incomeLines.push({ title: "Тварини", amount: breakdown.pets, sub: "" });
  if (breakdown.earlyLate > 0)
    incomeLines.push({ title: "Гнучкий графік", amount: breakdown.earlyLate, sub: "" });
  for (const [id, amount] of Object.entries(breakdown.services)) {
    if (amount <= 0) continue;
    incomeLines.push({
      title: serviceNames[id] || `Послуга ${id}`,
      amount,
      sub: "Додаткова послуга",
    });
  }

  const expenseLines: FinanceReport["expenseLines"] = [];
  let manualIncomeTotal = 0;
  let totalExpense = 0;

  (transactions || []).forEach((t) => {
    const tDate = parseSafeDate(String(t.date));
    if (tDate < startDate || tDate > endDate) return;
    const amt = Math.round(Number(t.amount) || 0);
    if (amt <= 0) return;
    const title = t.category || (t.type === "income" ? "Дохід" : "Витрата");
    const sub = t.comment ? String(t.comment).trim() : "";
    if (t.type === "income") {
      manualIncomeTotal += amt;
      incomeLines.push({ title, amount: amt, sub });
    } else if (t.type === "expense") {
      totalExpense += amt;
      expenseLines.push({ title, amount: amt, sub });
    }
  });

  const totalIncome = bookingIncome + manualIncomeTotal;
  const accrualRaw = calculateAccrualBalances(bookings, endDate, startDate);

  return {
    periodLabel,
    periodDisplay,
    periodStart: startDate.toISOString(),
    periodEnd: endDate.toISOString(),
    bookingsCount,
    totalIncome,
    cashInflow,
    totalExpense,
    profit: totalIncome - totalExpense,
    payments,
    incomeLines,
    expenseLines,
    accrual: {
      creditorTotal: accrualRaw.creditorTotal,
      debtorTotal: accrualRaw.debtorTotal,
      snapshotLabel: accrualRaw.snapshotLabel,
    },
  };
}
