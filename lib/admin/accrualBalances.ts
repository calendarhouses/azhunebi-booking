import { parseSafeDate, formatPhone } from "@/components/admin/desktop/adminDates";
import type { BookingRecord } from "@/components/admin/desktop/types";
import type { BosoDetailItem } from "@/components/admin/desktop/reports/types";
import { dateOnly, paidUntilDate } from "./bookingPayments";

export interface AccrualResult {
  creditorTotal: number;
  debtorTotal: number;
  earnedInPeriod: number;
  creditorItems: BosoDetailItem[];
  debtorItems: BosoDetailItem[];
  snapshotLabel: string;
}

function bookingNights(checkIn: string, checkOut: string): number {
  const cin = dateOnly(checkIn);
  const cout = dateOnly(checkOut);
  return Math.max(1, Math.round((cout.getTime() - cin.getTime()) / 86400000));
}

/** Скільки вартості послуги вже «надано» на дату зрізу (пропорційно ночам). */
export function earnedAtDate(
  checkIn: string,
  checkOut: string,
  totalPrice: number | string,
  asOfDate: Date | string
): number {
  const price = Math.round(Number(totalPrice) || 0);
  if (price <= 0) return 0;
  const cin = dateOnly(checkIn);
  const cout = dateOnly(checkOut);
  const asOf = dateOnly(asOfDate);
  if (asOf < cin) return 0;
  if (asOf >= cout) return price;
  const totalNights = bookingNights(checkIn, checkOut);
  const nightsUsed = Math.max(0, Math.round((asOf.getTime() - cin.getTime()) / 86400000));
  return Math.round((price * nightsUsed) / totalNights);
}

/** Нарахований дохід за ночі, що потрапили в обраний період. */
export function earnedInPeriod(
  checkIn: string,
  checkOut: string,
  totalPrice: number | string,
  startDate: Date,
  endDate: Date
): number {
  const price = Math.round(Number(totalPrice) || 0);
  if (price <= 0) return 0;
  const cin = dateOnly(checkIn);
  const cout = dateOnly(checkOut);
  const start = dateOnly(startDate);
  const end = dateOnly(endDate);
  end.setHours(23, 59, 59, 999);
  if (cout <= start || cin > end) return 0;
  const totalNights = bookingNights(checkIn, checkOut);
  let nightsInPeriod = 0;
  const d = new Date(cin);
  while (d < cout) {
    if (d >= start && d <= end) nightsInPeriod++;
    d.setDate(d.getDate() + 1);
  }
  return Math.round((price * nightsInPeriod) / totalNights);
}

function bookingDetailRow(
  b: BookingRecord,
  amount: number,
  suffix: string
): BosoDetailItem {
  const inD = parseSafeDate(String(b.checkIn));
  const outD = parseSafeDate(String(b.checkOut));
  const fIn = inD
    .toLocaleDateString("uk-UA", { day: "numeric", month: "long" })
    .replace(".", "");
  const fOut = outD
    .toLocaleDateString("uk-UA", { day: "numeric", month: "long" })
    .replace(".", "");
  return {
    name:
      (String(b.name || "Клієнт").replace(" (Ручна бронь)", "").trim() || "Клієнт") +
      suffix,
    phone: formatPhone(String(b.phone || "")),
    date: `${fIn} — ${fOut}`,
    row: b.row,
    amount: Math.round(amount),
    isTrans: false,
    rawDate: inD.getTime(),
  };
}

export function calculateAccrualBalances(
  bookings: BookingRecord[],
  endDate: Date,
  startDate?: Date | null
): AccrualResult {
  const snapEnd = new Date(endDate);
  snapEnd.setHours(23, 59, 59, 999);
  let creditorTotal = 0;
  let debtorTotal = 0;
  let earnedInPeriodTotal = 0;
  const creditorItems: BosoDetailItem[] = [];
  const debtorItems: BosoDetailItem[] = [];

  (bookings || []).forEach((b) => {
    if (String(b.status || "").toLowerCase().includes("скас")) return;
    const price = Number(b.totalPrice) || 0;
    const paid = paidUntilDate(b, snapEnd);
    if (price <= 0 && paid <= 0) return;

    const earnedSnap = earnedAtDate(b.checkIn, b.checkOut, price, snapEnd);
    if (startDate && endDate) {
      earnedInPeriodTotal += earnedInPeriod(
        String(b.checkIn),
        String(b.checkOut),
        price,
        startDate,
        endDate
      );
    }

    const advance = Math.max(0, paid - earnedSnap);
    const debt = Math.max(0, earnedSnap - paid);
    if (advance > 0) {
      creditorTotal += advance;
      creditorItems.push(bookingDetailRow(b, advance, " · кредиторка"));
    }
    if (debt > 0) {
      debtorTotal += debt;
      debtorItems.push(bookingDetailRow(b, debt, " · борг"));
    }
  });

  creditorItems.sort((a, b) => b.amount - a.amount);
  debtorItems.sort((a, b) => b.amount - a.amount);

  const pad = (n: number) => String(n).padStart(2, "0");
  const snapLabel = `${pad(snapEnd.getDate())}.${pad(snapEnd.getMonth() + 1)}.${snapEnd.getFullYear()}`;

  return {
    creditorTotal,
    debtorTotal,
    earnedInPeriod: earnedInPeriodTotal,
    creditorItems,
    debtorItems,
    snapshotLabel: snapLabel,
  };
}
