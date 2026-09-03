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
    surchargeMethod: "Готівка",
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

  it("counts only confirmed bookings created on the day", () => {
    const bookings = [
      booking({ id: "A-1", prepayAmount: 3200, prepayMethod: "Картка" }),
      booking({
        id: "A-2",
        assignmentState: "holding",
        createdAt: `${TODAY}T11:00:00.000Z`,
      }),
      booking({
        id: "A-3",
        status: "Очікує оплату",
        createdAt: `${TODAY}T12:00:00.000Z`,
        prepayAmount: 2900,
        prepayMethod: "ФОП",
      }),
      booking({
        id: "A-4",
        status: "Закрито",
        createdAt: `${TODAY}T13:00:00.000Z`,
      }),
    ];
    expect(countBookingsCreatedInRange(bookings, TODAY, TODAY)).toBe(1);
  });

  it("evening-style: only money from today's new bookings, not old check-ins or unpaid expected", () => {
    const bookings = [
      booking({
        id: "B-1",
        source: "Сайт",
        status: "Очікує оплату",
        prepayAmount: 2900,
        prepayMethod: "ФОП",
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
            method: "MonoPay",
            type: "prepay",
          },
        ],
      }),
      booking({
        id: "B-3",
        createdAt: "2026-08-20T09:00:00.000Z",
        checkIn: TODAY,
        payments: [
          {
            id: "p2",
            date: TODAY,
            amount: 3700,
            method: "ФОП",
            type: "prepay",
          },
        ],
      }),
    ];

    expect(countBookingsCreatedInRange(bookings, TODAY, TODAY)).toBe(1);
    const payments = sumFinancePaymentsInRange(bookings, TODAY, TODAY);
    expect(payments.card).toBe(3200);
    expect(payments.fop).toBe(0);
    expect(payments.cash).toBe(0);
  });

  it("month digest does not pull checkout remainders from older bookings", () => {
    const stats = buildFinancePeriodStats(
      [
        booking({
          id: "C-new",
          createdAt: "2026-08-10T09:00:00.000Z",
          payments: [
            { id: "p", date: "2026-08-10", amount: 3200, method: "Картка", type: "prepay" },
          ],
        }),
        booking({
          id: "C-old",
          createdAt: "2026-07-01T09:00:00.000Z",
          checkIn: "2026-08-15",
          payments: [
            { id: "s", date: "2026-08-15", amount: 20000, method: "Готівка", type: "surcharge" },
          ],
        }),
      ],
      [],
      "2026-08-01",
      "2026-08-31"
    );
    expect(stats.bookingsCount).toBe(1);
    expect(stats.totalIncome).toBe(3200);
    expect(stats.payments.card).toBe(3200);
    expect(stats.payments.cash).toBe(0);
  });
});
