import { chessboardKeyboard, getFinanceTargets, isTelegramConfigured } from "./config";
import {
  escapeHtml,
  formatDateUk,
  formatMoneyUa,
  formatPhoneDisplay,
} from "./formatters";
import { sendTelegramMessage, sendTelegramPhotoBase64 } from "./sendMessage";

export type PaymentReceivedNotifyInput = {
  name?: string;
  phone?: string;
  cottage?: string;
  checkIn?: string;
  checkOut?: string;
  totalPrice?: number;
  paidAmount?: number;
  amount: number;
  method?: string;
  screenshotPayment?: string;
};

export function buildPaymentReceivedCaption(
  data: PaymentReceivedNotifyInput,
  opts?: { short?: boolean }
): string {
  const total = Math.round(Number(data.totalPrice) || 0);
  const paid = Math.round(Number(data.paidAmount) || 0);
  const amount = Math.round(Number(data.amount) || 0);
  const balance = total - paid;
  const balanceLine =
    balance <= 0
      ? "✅ <b>Оплачено повністю</b>"
      : `⚠️ Залишок: <b>${formatMoneyUa(balance)}</b>`;

  if (opts?.short) {
    return [
      balanceLine,
      `🏡 <b>${escapeHtml(data.cottage || "Котедж")}</b>`,
      `📅 ${formatDateUk(data.checkIn)} — ${formatDateUk(data.checkOut)}`,
    ].join("\n");
  }

  const phone = formatPhoneDisplay(data.phone);
  return [
    balanceLine,
    `🏡 <b>${escapeHtml(data.cottage || "Котедж")}</b>`,
    `📅 ${formatDateUk(data.checkIn)} — ${formatDateUk(data.checkOut)}`,
    "",
    `👤 ${escapeHtml(data.name || "Гість")}${phone ? ` (${phone})` : ""}`,
    `💵 Доплата: <b>${formatMoneyUa(amount)}</b> (<b>${escapeHtml(data.method || "Готівка")}</b>)`,
    `💰 Загальна сума: <b>${formatMoneyUa(total)}</b>`,
    `💳 Всього внесено: <b>${formatMoneyUa(paid)}</b>`,
  ].join("\n");
}

export async function notifyPaymentReceived(
  data: PaymentReceivedNotifyInput
): Promise<boolean> {
  if (!isTelegramConfigured()) {
    console.warn("[TG] Skipping payment notify — Telegram not configured");
    return false;
  }
  const amount = Math.round(Number(data.amount) || 0);
  if (amount <= 0) return false;

  const target = getFinanceTargets();
  const keyboard = chessboardKeyboard();

  let res: Response;
  if (data.screenshotPayment) {
    res = await sendTelegramPhotoBase64(
      data.screenshotPayment,
      buildPaymentReceivedCaption(data, { short: true }),
      keyboard,
      target
    );
  } else {
    res = await sendTelegramMessage(
      buildPaymentReceivedCaption(data),
      keyboard,
      target.chatId,
      target.threadId
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[TG] payment notify failed", res.status, body);
    return false;
  }
  return true;
}
