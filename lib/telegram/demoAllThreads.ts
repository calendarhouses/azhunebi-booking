import "server-only";

import { buildPendingReviewCaption } from "./bookingReviewNotify";
import { buildArrivalDepartureCaption } from "./arrivalDepartureNotify";
import { buildCleaningTurnoversDigest } from "./cleaningArrivalNotify";
import {
  buildDebtCaption,
  buildEveningCashCaption,
  buildFinancePeriodCaption,
} from "./financeNotify";
import { buildNewBookingAdminCaption } from "./newBookingNotify";
import { buildPaidBookingTelegramText } from "./paidBookingNotify";
import { buildPaymentReceivedCaption } from "./paymentReceivedNotify";
import {
  chessboardKeyboard,
  getArrivalsTargets,
  getBookingsTargets,
  getChangesTargets,
  getCleaningTargets,
  getFinanceTargets,
  getRequestsTargets,
  isTelegramConfigured,
} from "./config";
import { sendTelegramMessage } from "./sendMessage";
import { buildChangeLogCaption } from "./changeLogNotify";
import type { GasBookingRecord } from "@/lib/gas-api-server";

/**
 * Sends one sample message of each notification type into the correct forum topic.
 * Text only — no static images. Finance report screenshot is not included here
 * (that comes from admin «Звіт у Telegram»).
 */
export async function sendTelegramDemoAllThreads(): Promise<Record<string, boolean | string>> {
  if (!isTelegramConfigured()) {
    throw new Error("Telegram is not configured");
  }

  const bookings = getBookingsTargets();
  const requests = getRequestsTargets();
  const arrivals = getArrivalsTargets();
  const cleaning = getCleaningTargets();
  const finance = getFinanceTargets();
  const changes = getChangesTargets();
  const keyboard = chessboardKeyboard();
  const results: Record<string, boolean | string> = {};

  const demoBooking = {
    name: "Назар Тест",
    phone: "+380501112233",
    cottage: "Будиночок 2",
    checkIn: "2026-07-20",
    checkOut: "2026-07-22",
    guests: 2,
    pets: "Ні",
    source: "Адмінка",
    comment: "👶 Діти: 2 | 🕒#early: 10:00\n\nКоментар гостя: Тестове бронювання",
    totalPrice: 12100,
    paidAmount: 5000,
  };

  // ── БРОНЮВАННЯ ──
  {
    const res = await sendTelegramMessage(
      "🧪 <b>ТЕСТ</b>\n\n" + buildNewBookingAdminCaption(demoBooking),
      keyboard,
      bookings.chatId,
      bookings.threadId
    );
    results.newBooking = res.ok;
  }
  {
    const paidDemo = {
      id: "A-TESTDEMO",
      name: demoBooking.name,
      phone: "380501112233",
      cottage: demoBooking.cottage,
      checkIn: demoBooking.checkIn,
      checkOut: demoBooking.checkOut,
      guests: 2,
      pets: "Ні",
      comment: demoBooking.comment,
      totalPrice: 6000,
      paidAmount: 1,
    } satisfies GasBookingRecord;
    const res = await sendTelegramMessage(
      "🧪 <b>ТЕСТ</b>\n\n" + buildPaidBookingTelegramText(paidDemo),
      undefined,
      bookings.chatId,
      bookings.threadId
    );
    results.paidBooking = res.ok;
  }

  // ── ЗАПИТИ БРОНЮВАННЯ ──
  {
    const caption = buildPendingReviewCaption({
      orderId: "A-TESTDEMO",
      name: demoBooking.name,
      phone: demoBooking.phone,
      cottage: demoBooking.cottage,
      checkIn: demoBooking.checkIn,
      checkOut: demoBooking.checkOut,
      guests: 2,
      totalPrice: 6000,
      prepayAmount: 1000,
      comment: "🕒#early⏳: 10:00",
      source: "Сайт",
    });
    const res = await sendTelegramMessage(
      "🧪 <b>ТЕСТ</b>\n\n" + caption,
      {
        inline_keyboard: [
          [
            { text: "✅ Прийняти (тест)", callback_data: "br:demo:ok" },
            { text: "❌ Відхилити (тест)", callback_data: "br:demo:no" },
          ],
        ],
      },
      requests.chatId,
      requests.threadId
    );
    results.pendingReview = res.ok;
  }

  // ── ЗАЇЗД / ВИЇЗД ──
  {
    const res = await sendTelegramMessage(
      "🧪 <b>ТЕСТ</b>\n\n" +
        buildArrivalDepartureCaption(
          {
            ...demoBooking,
            status: "Підтверджено",
            paidAmount: 5000,
          },
          "arrival"
        ),
      keyboard,
      arrivals.chatId,
      arrivals.threadId
    );
    results.arrival = res.ok;
  }
  {
    const res = await sendTelegramMessage(
      "🧪 <b>ТЕСТ</b>\n\n" +
        buildArrivalDepartureCaption(
          {
            ...demoBooking,
            status: "Підтверджено",
            paidAmount: 12100,
          },
          "departure"
        ),
      keyboard,
      arrivals.chatId,
      arrivals.threadId
    );
    results.departure = res.ok;
  }

  // ── ПРИБИРАННЯ — дайджест turnover (виїзд+заїзд / лише виїзд / лише заїзд) ──
  {
    const res = await sendTelegramMessage(
      "🧪 <b>ТЕСТ ПРИБИРАННЯ</b>\n\n" +
        buildCleaningTurnoversDigest([
          {
            cottage: "Будиночок 1",
            departure: { ...demoBooking, cottage: "Будиночок 1", guests: 2, comment: "👶 Діти: 1" },
            arrival: { ...demoBooking, cottage: "Будиночок 1", guests: 3, comment: "👶 Діти: 1" },
          },
          {
            cottage: "Будиночок 2",
            departure: { ...demoBooking, cottage: "Будиночок 2", guests: 4, comment: "" },
            arrival: { ...demoBooking, cottage: "Будиночок 2", guests: 2, comment: "👶 Діти: 2" },
          },
          {
            cottage: "Будиночок 7",
            departure: { ...demoBooking, cottage: "Будиночок 7", guests: 2, comment: "👶 Діти: 2" },
          },
          {
            cottage: "Будиночок 4",
            arrival: { ...demoBooking, cottage: "Будиночок 4", guests: 2, comment: "" },
          },
        ]),
      undefined,
      cleaning.chatId,
      cleaning.threadId
    );
    results.cleaningTurnoverBoth = res.ok;
    results.cleaningTurnoverDepartureOnly = res.ok;
    results.cleaningTurnoverArrivalOnly = res.ok;
    results.cleaningChatId = cleaning.chatId;
    if (!res.ok) {
      results.cleaningTurnoverError = await res.text().catch(() => "unknown");
    }
  }

  // ── ФІНАНСИ / ЗВІТИ ──
  {
    const res = await sendTelegramMessage(
      "🧪 <b>ТЕСТ</b>\n\n" +
        buildPaymentReceivedCaption({
          ...demoBooking,
          amount: 2000,
          method: "Готівка",
          paidAmount: 7000,
          kind: "surcharge",
        }),
      keyboard,
      finance.chatId,
      finance.threadId
    );
    results.payment = res.ok;
  }
  {
    const res = await sendTelegramMessage(
      "🧪 <b>ТЕСТ</b>\n\n" +
        buildEveningCashCaption({
          newBookingsCount: 3,
          payments: { cash: 4500, card: 1200, fop: 8000 },
        }),
      null,
      finance.chatId,
      finance.threadId
    );
    results.evening = res.ok;
  }
  {
    const res = await sendTelegramMessage(
      "🧪 <b>ТЕСТ</b>\n\n" +
        buildFinancePeriodCaption("📊", "ТИЖНЕВЕ ЗВЕДЕННЯ", "14.07 — 20.07", {
          bookingsCount: 8,
          totalIncome: 64200,
          totalExpense: 12100,
          profit: 52100,
          payments: { cash: 18000, card: 9200, fop: 37000 },
        }),
      null,
      finance.chatId,
      finance.threadId
    );
    results.weekly = res.ok;
  }
  {
    const res = await sendTelegramMessage(
      "🧪 <b>ТЕСТ</b>\n\n" +
        buildFinancePeriodCaption("📆", "МІСЯЧНЕ ЗВЕДЕННЯ", "липень 2026", {
          bookingsCount: 27,
          totalIncome: 214500,
          totalExpense: 48300,
          profit: 166200,
          payments: { cash: 52000, card: 31500, fop: 131000 },
        }),
      null,
      finance.chatId,
      finance.threadId
    );
    results.monthly = res.ok;
  }
  {
    const res = await sendTelegramMessage(
      "🧪 <b>ТЕСТ</b>\n\n" + buildDebtCaption("Будиночок 2", 5999),
      null,
      finance.chatId,
      finance.threadId
    );
    results.debt = res.ok;
  }
  {
    const res = await sendTelegramMessage(
      "🧪 <b>ТЕСТ</b>\n\n📊 <b>Фінансовий звіт</b>\n<i>Скрін звіту з адмінки приходить лише з кнопки «Звіт у Telegram» — тут лише текст-заглушка.</i>",
      keyboard,
      finance.chatId,
      finance.threadId
    );
    results.financeReportHint = res.ok;
  }

  if (changes) {
    const res = await sendTelegramMessage(
      "🧪 <b>ТЕСТ</b>\n\n" +
        buildChangeLogCaption({
          title: "Бронь оновлено",
          titleEmoji: "✏️",
          actorName: "Назар",
          actorRole: "owner",
          booking: {
            id: "A-TESTDEMO",
            name: "Назар Тест",
            cottage: "Будиночок 2",
          },
          cottage: "Будиночок 2",
          lines: [
            {
              label: "Статус",
              from: "Очікує оплату",
              to: "Скасовано",
            },
            {
              label: "Дати",
              from: "2026-09-03 → 2026-09-05",
              to: "2026-09-04 → 2026-09-06",
            },
          ],
        }),
      null,
      changes.chatId,
      changes.threadId
    );
    results.changeLog = res.ok;
  } else {
    results.changeLog = "thread_disabled";
  }

  return results;
}
