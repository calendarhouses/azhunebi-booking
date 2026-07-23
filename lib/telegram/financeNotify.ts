import {
  chessboardKeyboard,
  getFinanceTargets,
  isTelegramConfigured,
} from "./config";
import {
  compareByCottageNumber,
  escapeHtml,
  formatMoneyUa,
  formatTelegramDaySeparator,
  isConfirmedBookingStatus,
  toDateKeyKyiv,
  todayKeyKyiv,
} from "./formatters";
import { sendTelegramMessage, sendTelegramPhotoBase64 } from "./sendMessage";

export type FinancePeriodStats = {
  bookingsCount: number;
  totalIncome: number;
  totalExpense: number;
  profit: number;
  payments: { cash: number; card: number; fop: number };
};

export function buildFinancePeriodCaption(
  titleEmoji: string,
  title: string,
  periodLabel: string,
  stats: FinancePeriodStats
): string {
  return (
    `${titleEmoji} <b>${escapeHtml(title)}</b>\n` +
    `<i>${escapeHtml(periodLabel)}</i>\n\n` +
    `📝 Заїздів: <b>${stats.bookingsCount}</b>\n` +
    `💰 Дохід: <b>${formatMoneyUa(stats.totalIncome)}</b>\n` +
    `💵 Готівка: <b>${formatMoneyUa(stats.payments.cash)}</b>\n` +
    `💳 Картка: <b>${formatMoneyUa(stats.payments.card)}</b>\n` +
    `🏦 ФОП: <b>${formatMoneyUa(stats.payments.fop)}</b>\n` +
    `📉 Витрати: <b>${formatMoneyUa(stats.totalExpense)}</b>\n` +
    `✅ Чистий прибуток: <b>${formatMoneyUa(stats.profit)}</b>`
  );
}

/** Only finance reports keep an image (admin-generated screenshot). */
export async function sendFinanceReportTelegram(payload: {
  screenshot: string;
  periodLabel?: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!isTelegramConfigured()) {
    return { success: false, error: "TELEGRAM", message: "Telegram not configured" };
  }
  if (!payload.screenshot) return { success: false, error: "NO_SCREENSHOT" };

  const target = getFinanceTargets();
  const caption = payload.periodLabel
    ? `📊 <b>Фінансовий звіт</b>\n<i>${escapeHtml(payload.periodLabel)}</i>`
    : "📊 <b>Фінансовий звіт</b>";
  const res = await sendTelegramPhotoBase64(
    payload.screenshot,
    caption,
    chessboardKeyboard(),
    target
  );
  try {
    const json = (await res.json()) as { ok?: boolean; description?: string };
    if (!json.ok) {
      return {
        success: false,
        error: "TELEGRAM",
        message: json.description || "Telegram API error",
      };
    }
  } catch {
    return { success: false, error: "TELEGRAM_PARSE" };
  }
  return { success: true };
}

export async function sendFinancePeriodSummary(opts: {
  titleEmoji: string;
  title: string;
  periodLabel: string;
  stats: FinancePeriodStats;
  /** Demo / force send even with zero activity */
  force?: boolean;
}): Promise<boolean> {
  if (!isTelegramConfigured()) return false;
  if (
    !opts.force &&
    opts.stats.bookingsCount <= 0 &&
    opts.stats.totalIncome <= 0 &&
    opts.stats.totalExpense <= 0
  ) {
    return false;
  }
  const caption = buildFinancePeriodCaption(
    opts.titleEmoji,
    opts.title,
    opts.periodLabel,
    opts.stats
  );
  const target = getFinanceTargets();
  const res = await sendTelegramMessage(caption, null, target.chatId, target.threadId);
  return res.ok;
}

export type EveningCashBooking = {
  status?: string;
  createdAt?: string;
  paidAmount?: number | string;
  prepayAmount?: number | string;
  surchargeAmount?: number | string;
  prepayMethod?: string;
  surchargeMethod?: string;
  payments?: Array<{ amount?: number; method?: string; date?: string }>;
};

function collectMethodAmount(
  method: string | undefined,
  amount: number,
  bucket: { cash: number; card: number; fop: number }
) {
  if (amount <= 0) return;
  const m = String(method || "").toLowerCase();
  if (m.includes("гот")) bucket.cash += amount;
  else if (m.includes("карт") || m.includes("mono") || m.includes("еквайр")) bucket.card += amount;
  else bucket.fop += amount;
}

export function buildEveningCashCaption(opts: {
  newBookingsCount: number;
  payments: { cash: number; card: number; fop: number };
}): string {
  const paymentsSum = opts.payments.cash + opts.payments.card + opts.payments.fop;
  return (
    `🌙 <b>ВЕЧІРНЄ ЗВЕДЕННЯ</b>\n\n` +
    `📝 Нових бронювань: <b>${opts.newBookingsCount}</b>\n` +
    `💰 Надійшло оплат: <b>${formatMoneyUa(paymentsSum)}</b>\n` +
    `💵 Готівка: <b>${formatMoneyUa(opts.payments.cash)}</b>\n` +
    `💳 Картка: <b>${formatMoneyUa(opts.payments.card)}</b>\n` +
    `🏦 ФОП: <b>${formatMoneyUa(opts.payments.fop)}</b>\n` +
    `🗝 <i>Фінансовий день закрито</i>`
  );
}

export async function sendEveningCashSummary(
  bookings: EveningCashBooking[]
): Promise<boolean> {
  if (!isTelegramConfigured()) return false;
  const today = todayKeyKyiv();
  let newBookingsCount = 0;
  const payments = { cash: 0, card: 0, fop: 0 };

  for (const b of bookings) {
    const created = toDateKeyKyiv(b.createdAt);
    if (created !== today) continue;
    if (String(b.status || "").toLowerCase().includes("скас")) continue;
    newBookingsCount += 1;

    if (Array.isArray(b.payments) && b.payments.length) {
      for (const p of b.payments) {
        const pDate = toDateKeyKyiv(p.date) || today;
        if (pDate !== today) continue;
        collectMethodAmount(p.method, Math.round(Number(p.amount) || 0), payments);
      }
    } else {
      collectMethodAmount(
        b.prepayMethod,
        Math.round(Number(b.prepayAmount) || 0),
        payments
      );
      collectMethodAmount(
        b.surchargeMethod,
        Math.round(Number(b.surchargeAmount) || 0),
        payments
      );
    }
  }

  const paymentsSum = payments.cash + payments.card + payments.fop;
  if (newBookingsCount === 0 && paymentsSum === 0) return false;

  const target = getFinanceTargets();
  const res = await sendTelegramMessage(
    buildEveningCashCaption({ newBookingsCount, payments }),
    null,
    target.chatId,
    target.threadId
  );
  return res.ok;
}

export type DebtBooking = {
  cottage?: string;
  checkIn?: string;
  checkOut?: string;
  status?: string;
  totalPrice?: number | string;
  paidAmount?: number | string;
};

export function buildDebtCaption(cottage: string, debt: number): string {
  return (
    `⚠️ <b>Увага: Неоплачений залишок</b>\n\n` +
    `🏠 Котедж: <b>${escapeHtml(cottage || "Котедж")}</b>\n` +
    `💳 Доплата: <b>${formatMoneyUa(debt)}</b>`
  );
}

/** Reminder on checkout day for unpaid balance (confirmed bookings only). */
export async function sendDebtReminders(bookings: DebtBooking[]): Promise<number> {
  if (!isTelegramConfigured()) return 0;
  const today = todayKeyKyiv();
  const target = getFinanceTargets();

  const due = bookings
    .filter((b) => {
      if (!isConfirmedBookingStatus(b.status)) return false;
      if (toDateKeyKyiv(b.checkOut) !== today) return false;
      const debt =
        Math.round(Number(b.totalPrice) || 0) - Math.round(Number(b.paidAmount) || 0);
      return debt > 0;
    })
    .map((b) => ({
      booking: b,
      debt: Math.round(Number(b.totalPrice) || 0) - Math.round(Number(b.paidAmount) || 0),
    }))
    .sort((a, b) => compareByCottageNumber(a.booking.cottage, b.booking.cottage));

  if (due.length === 0) return 0;

  const separator = await sendTelegramMessage(
    formatTelegramDaySeparator(),
    null,
    target.chatId,
    target.threadId
  );
  if (!separator.ok) {
    console.error("[TG] debt day separator failed", await separator.text().catch(() => ""));
  }

  let sent = 0;
  for (const item of due) {
    const res = await sendTelegramMessage(
      buildDebtCaption(String(item.booking.cottage || "Котедж"), item.debt),
      null,
      target.chatId,
      target.threadId
    );
    if (res.ok) sent += 1;
  }
  return sent;
}
