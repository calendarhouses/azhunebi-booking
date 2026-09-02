import { describe, expect, it } from "vitest";
import {
  buildFinancePeriodStats,
  countBookingsCreatedInRange,
  sumFinancePaymentsInRange,
} from "@/lib/telegram/financeDigestStats";
import { bookingCreatedDateKey } from "@/lib/telegram/formatters";
import type { BookingRecord } from "@/components/admin/desktop/types";

const TODAY = "2026-09-01";

function booking(partial: Partial<BookingRecord> & { id: string }): BookingRecord {
  return {
    status: "Підтверджено",
    checkIn: TODAY,
    checkOut: "2026-09-03",
    createdAt: `${TODAY}T10:00:00.000Z`,
    prepayAmount: 0,
    prepayMethod: "ФОП",
    surchargeAmount: 0,
    surchargeMethod: "Гotівka",
    paidAmount: 0,
    totalPrice: 5000,
    ...partial,
  } as BookingRecord;
}

describe("financeDigestStats", () => {
  it("does not treat chessboard drag as new booking when createdAt was rewritten", () => {
    const moved = booking({
      id: "A-1725123456789",
      createdAt: `${TODAY}T18:00:00.000Z`,
    });
    expect(bookingCreatedDateKey(moved)).not.toBe(TODAY);
    expect(countBookingsCreatedInRange([moved], TODAY, TODAY)).toBe(0);
  });

  it("counts only active bookings created on the day (excludes holding)", () => {
    const bookings = [
      booking({ id: "A-1", prepayAmount: 3200, prepayMethod: "Картka" }),
      booking({
        id: "A-2",
        assignmentState: "holding",
        createdAt: `${TODAY}T11:00:00.000Z`,
      }),
    ];
    expect(countBookingsCreatedInRange(bookings, TODAY, TODAY)).toBe(1);
  });

  it("uses payment journal dates (incl. at) and skips unpaid site expected prepay", () => {
    const bookings = [
      booking({
        id: "B-1",
        source: "Сайт",
        status: "Очікує оплату",
        prepayAmount: 3200,
        prepayMethod: "Картka",
        payments: [],
      }),
      booking({
        id: "B-2",
        createdAt: `${TODAY}T09:00:00.000Z`,
        payments: [
          {
            id: "p1",
            date: TODAY,
            amount: 3200,
            method: "Картka",
            type: "prepay",
          },
        ],
      }),
      booking({
        id: "B-3",
        createdAt: "2026-08-20T09:00:00.000Z",
        checkIn: "2026-09-10",
        payments: [
          {
            id: "p2",
            at: `${TODAY}T15:00:00.000Z`,
            amount: 2900,
            method: "ФОП",
            type: "prepay",
          },
        ],
      }),
    ];

    const payments = sumFinancePaymentsInRange(bookings, TODAY, TODAY);
    expect(payments.card).toBe(3200);
    expect(payments.fop).toBe(2900);
    expect(payments.cash).toBe(0);
  });

  it("matches admin-style period stats", () => {
    const stats = buildFinancePeriodStats(
      [
        booking({
          id: "C-1",
          payments: [{ id: "p", date: TODAY, amount: 3200, method: "Картka", type: "prepay" }],
        }),
      ],
      [],
      TODAY,
      TODAY
    );
    expect(stats.bookingsCount).toBe(1);
    expect(stats.totalIncome).toBe(3200);
    expect(stats.payments.card).toBe(3200);
  });
});
