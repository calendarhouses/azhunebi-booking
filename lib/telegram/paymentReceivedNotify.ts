import { chessboardKeyboard, getFinanceTargets, isTelegramConfigured } from "./config";
import {
  escapeHtml,
  formatDateUk,
  formatMoneyUa,
  formatPhoneDisplay,
} from "./formatters";
import { sendTelegramMessage } from "./sendMessage";

export type PaymentReceivedKind = "prepay" | "full" | "surcharge";

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
  bookingId?: string;
  kind?: PaymentReceivedKind;
  screenshotPayment?: string;
};

function titleFor(kind: PaymentReceivedKind, fullyPaid: boolean): string {
  if (fullyPaid || kind === "full") return "✅ <b>Оплачено повністю</b>";
  if (kind === "prepay") return "💳 <b>Оплачена передплата</b>";
  return "💵 <b>Доплата</b>";
}

export function buildPaymentReceivedCaption(
  data: PaymentReceivedNotifyInput
): string {
  const total = Math.round(Number(data.totalPrice) || 0);
  const paid = Math.round(Number(data.paidAmount) || 0);
  const amount = Math.round(Number(data.amount) || 0);
  const balance = total - paid;
  const fullyPaid = total > 0 && balance <= 0 && paid > 0;
  const kind: PaymentReceivedKind =
    data.kind || (fullyPaid ? "full" : "surcharge");
  const phone = formatPhoneDisplay(data.phone);
  const incomingLabel =
    kind === "prepay" ? "Передплата" : kind === "full" ? "Повна оплата" : "Доплата";

  const lines = [
    titleFor(kind, fullyPaid),
    `🏡 <b>${escapeHtml(data.cottage || "Котедж")}</b>`,
    `📅 ${formatDateUk(data.checkIn)} — ${formatDateUk(data.checkOut)}`,
  ];
  if (data.bookingId) lines.push(`🔖 ${escapeHtml(data.bookingId)}`);
  lines.push(
    "",
    `👤 ${escapeHtml(data.name || "Гість")}${phone ? ` (${phone})` : ""}`,
    `💵 ${incomingLabel}: <b>${formatMoneyUa(amount)}</b> (<b>${escapeHtml(data.method || "MonoPay")}</b>)`,
    `💰 Загальна сума: <b>${formatMoneyUa(total)}</b>`,
    `💳 Всього внесено: <b>${formatMoneyUa(paid)}</b>`
  );
  if (!fullyPaid) {
    lines.push(`⚠️ Залишок: <b>${formatMoneyUa(Math.max(0, balance))}</b>`);
  }
  return lines.join("\n");
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
  const res = await sendTelegramMessage(
    buildPaymentReceivedCaption(data),
    keyboard,
    target.chatId,
    target.threadId
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[TG] payment notify failed", res.status, body);
    return false;
  }
  return true;
}
