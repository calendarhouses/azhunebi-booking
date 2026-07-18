import {
  chessboardKeyboard,
  getFinanceTargets,
  isTelegramConfigured,
} from "./config";
import {
  escapeHtml,
  formatMoneyUa,
  isConfirmedBookingStatus,
  toDateKeyKyiv,
  todayKeyKyiv,
} from "./formatters";
import { sendTelegramPhotoBase64, sendTelegramPhotoUrl } from "./sendMessage";

const TG_PHOTOS = {
  eveningKasa:
    process.env.TELEGRAM_PHOTO_EVENING_KASA?.trim() ||
    "https://imgpx.com/J3dXlnqB0Jea.png",
  debtReminder:
    process.env.TELEGRAM_PHOTO_DEBT?.trim() ||
    "https://imgpx.com/et8EBt4MryDH.png",
};

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
}): Promise<boolean> {
  if (!isTelegramConfigured()) return false;
  if (
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
  const res = await sendTelegramPhotoUrl(
    TG_PHOTOS.eveningKasa,
    caption,
    null,
    target
  );
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

export async function sendEveningCashSummary(
  bookings: EveningCashBooking[]
): Promise<boolean> {
  if (!isTelegramConfigured()) return false;
  const today = todayKeyKyiv();
  let newBookingsCount = 0;
  const payments = { cash: 0, card: 0, fop: 0 };

  for (const b of bookings) {
    if (!isConfirmedBookingStatus(b.status) && !String(b.status || "").includes("Очікує")) {
      // count today's created active-ish bookings
    }
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

  const caption =
    `🌙 <b>ВЕЧІРНЄ ЗВЕДЕННЯ</b>\n\n` +
    `📝 Нових бронювань: <b>${newBookingsCount}</b>\n` +
    `💰 Надійшло оплат: <b>${formatMoneyUa(paymentsSum)}</b>\n` +
    `💵 Готівка: <b>${formatMoneyUa(payments.cash)}</b>\n` +
    `💳 Картка: <b>${formatMoneyUa(payments.card)}</b>\n` +
    `🏦 ФОП: <b>${formatMoneyUa(payments.fop)}</b>\n` +
    `🗝 <i>Фінансовий день закрито</i>`;

  const res = await sendTelegramPhotoUrl(
    TG_PHOTOS.eveningKasa,
    caption,
    null,
    getFinanceTargets()
  );
  return res.ok;
}

export type DebtBooking = {
  cottage?: string;
  checkIn?: string;
  status?: string;
  totalPrice?: number | string;
  paidAmount?: number | string;
};

export async function sendDebtReminders(bookings: DebtBooking[]): Promise<number> {
  if (!isTelegramConfigured()) return 0;
  const today = todayKeyKyiv();
  const target = getFinanceTargets();
  let sent = 0;

  for (const b of bookings) {
    if (!isConfirmedBookingStatus(b.status)) continue;
    if (toDateKeyKyiv(b.checkIn) !== today) continue;
    const debt = Math.round(Number(b.totalPrice) || 0) - Math.round(Number(b.paidAmount) || 0);
    if (debt <= 0) continue;
    const caption =
      `⚠️ <b>Увага: Неоплачений залишок</b>\n\n` +
      `🏠 Котедж: <b>${escapeHtml(b.cottage || "Котедж")}</b>\n` +
      `💳 Доплата: <b>${formatMoneyUa(debt)}</b>`;
    const res = await sendTelegramPhotoUrl(TG_PHOTOS.debtReminder, caption, null, target);
    if (res.ok) sent += 1;
  }
  return sent;
}
