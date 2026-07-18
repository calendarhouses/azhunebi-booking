import { parseChildrenFromComment } from "@/components/admin/desktop/settings/additionalServicesLogic";
import { parseEarlyLateTimesFromComment } from "@/lib/admin/flexibleSchedule";
import { formatGuestsLabel } from "@/lib/public-booking/formatGuestsLabel";
import { chessboardKeyboard, getBookingsTargets, isTelegramConfigured } from "./config";
import {
  escapeHtml,
  formatDateUk,
  formatMoneyUa,
  formatPhoneDisplay,
} from "./formatters";
import { sendTelegramMessage, sendTelegramPhotoBase64 } from "./sendMessage";

export type NewBookingNotifyInput = {
  name?: string;
  phone?: string;
  cottage?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  pets?: string | boolean;
  source?: string;
  comment?: string;
  totalPrice?: number;
  paidAmount?: number;
  screenshot?: string;
  screenshotCleaning?: string;
};

function guestCommentOnly(raw?: string): string {
  const comment = String(raw || "");
  const marker = "Коментар гостя:";
  const index = comment.indexOf(marker);
  if (index >= 0) return comment.slice(index + marker.length).trim();
  return comment
    .replace(/👶\s*Діти[^|]+(\|\s*)?/g, "")
    .replace(/🛎️#[^|]+(\|\s*)?/g, "")
    .replace(/🕒#[^|]+(\|\s*)?/g, "")
    .replace(/🇺🇦 УБД: Так\s*(\|\s*)?/g, "")
    .replace(/^[|\s]+|[|\s]+$/g, "")
    .trim();
}

export function buildNewBookingAdminCaption(data: NewBookingNotifyInput): string {
  const total = Math.round(Number(data.totalPrice) || 0);
  const paid = Math.round(Number(data.paidAmount) || 0);
  const balance = total - paid;
  const phone = formatPhoneDisplay(data.phone);
  const guestsLabel = formatGuestsLabel(
    Number(data.guests) || 0,
    parseChildrenFromComment(data.comment || "")
  );
  const { earlyTime, lateTime } = parseEarlyLateTimesFromComment(data.comment || "");
  const pets =
    data.pets === true || data.pets === "Так" || String(data.pets).toLowerCase() === "так";
  const comment = guestCommentOnly(data.comment);
  const balanceLine =
    balance <= 0
      ? "✅ <b>Оплачено повністю</b>"
      : `⚠️ Залишок: <b>${formatMoneyUa(balance)}</b>`;

  const lines = [
    `🛎 <b>Нове бронювання</b> | ${escapeHtml(data.source || "Адмінка")}`,
    "",
    `🏡 <b>${escapeHtml(data.cottage || "—")}</b>`,
    `👤 ${escapeHtml(data.name || "Гість")}${phone ? ` (${phone})` : ""}`,
    `📅 ${formatDateUk(data.checkIn)} — ${formatDateUk(data.checkOut)}`,
    `👥 ${escapeHtml(guestsLabel)}`,
  ];
  if (pets) lines.push("🐾 З тваринами");
  if (earlyTime) lines.push(`🕒 Ранній заїзд: ${escapeHtml(earlyTime)}`);
  if (lateTime) lines.push(`🕒 Пізній виїзд: ${escapeHtml(lateTime)}`);
  if (comment) lines.push(`💬 ${escapeHtml(comment)}`);
  lines.push(
    "",
    `💰 Загальна сума: <b>${formatMoneyUa(total)}</b>`,
    `💳 Внесено: <b>${formatMoneyUa(paid)}</b>`,
    balanceLine
  );
  return lines.join("\n");
}

export async function notifyNewBookingCreated(
  data: NewBookingNotifyInput
): Promise<boolean> {
  if (!isTelegramConfigured()) {
    console.warn("[TG] Skipping new booking notify — Telegram not configured");
    return false;
  }
  const target = getBookingsTargets();
  const caption = buildNewBookingAdminCaption(data);
  const keyboard = chessboardKeyboard();

  let res: Response;
  if (data.screenshot) {
    res = await sendTelegramPhotoBase64(data.screenshot, caption, keyboard, target);
  } else {
    res = await sendTelegramMessage(caption, keyboard, target.chatId, target.threadId);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[TG] new booking notify failed", res.status, body);
    return false;
  }

  // Optional cleaning card → same БРОНЮВАННЯ thread (no separate cleaning group).
  if (data.screenshotCleaning) {
    const short = `🛎 <b>Нове бронювання | ${escapeHtml(data.cottage || "—")}</b>\n📅 ${formatDateUk(data.checkIn)} — ${formatDateUk(data.checkOut)}`;
    await sendTelegramPhotoBase64(data.screenshotCleaning, short, null, target).catch(
      () => undefined
    );
  }
  return true;
}
