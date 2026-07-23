import { parseChildrenFromComment, parseYoungestChildAgeFromComment } from "@/components/admin/desktop/settings/additionalServicesLogic";
import { parseEarlyLateTimesFromComment } from "@/lib/admin/flexibleSchedule";
import { formatGuestsLabel } from "@/lib/public-booking/formatGuestsLabel";
import {
  chessboardKeyboard,
  getArrivalsTargets,
  isTelegramConfigured,
} from "./config";
import {
  compareByCottageNumber,
  escapeHtml,
  formatDateUk,
  formatMoneyUa,
  formatPhoneDisplay,
  formatTelegramDaySeparator,
  isConfirmedBookingStatus,
  toDateKeyKyiv,
  todayKeyKyiv,
} from "./formatters";
import { sendTelegramMessage } from "./sendMessage";

export type ArrivalDepartureBooking = {
  id?: string;
  name?: string;
  phone?: string;
  cottage?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  pets?: string | boolean;
  status?: string;
  comment?: string;
  totalPrice?: number | string;
  paidAmount?: number | string;
};

function petsYes(pets: unknown): boolean {
  return pets === true || pets === "Так" || String(pets).toLowerCase() === "так";
}

function buildDetails(booking: ArrivalDepartureBooking, kind: "arrival" | "departure"): string {
  const guestsLabel = formatGuestsLabel(
    Number(booking.guests) || 0,
    parseChildrenFromComment(booking.comment || ""),
    parseYoungestChildAgeFromComment(booking.comment || "")
  );
  const { earlyTime, lateTime } = parseEarlyLateTimesFromComment(booking.comment || "");
  const hasUbd = (booking.comment || "").includes("🇺🇦 УБД: Так");
  const lines: string[] = [];
  if (kind === "arrival") {
    lines.push(`👥 ${escapeHtml(guestsLabel || "—")}`);
    if (petsYes(booking.pets)) lines.push("🐾 З твариною");
    if (hasUbd) lines.push("🇺🇦 УБД: Так");
    if (earlyTime) lines.push(`🕒 Ранній заїзд: з ${escapeHtml(earlyTime)}`);
  } else {
    lines.push(`👥 Було ${escapeHtml(guestsLabel || "—")}`);
    if (petsYes(booking.pets)) lines.push("🐾 Була тварина");
    if (hasUbd) lines.push("🇺🇦 УБД: Так");
    if (lateTime) lines.push(`🕒 Пізній виїзд: до ${escapeHtml(lateTime)}`);
  }
  return lines.join("\n");
}

export function buildArrivalDepartureCaption(
  booking: ArrivalDepartureBooking,
  kind: "arrival" | "departure"
): string {
  const total = Math.round(Number(booking.totalPrice) || 0);
  const paid = Math.round(Number(booking.paidAmount) || 0);
  const balance = total - paid;
  const balanceLine =
    balance <= 0
      ? "✅ <b>Оплачено повністю</b>"
      : `⚠️ Залишок до сплати: <b>${formatMoneyUa(balance)}</b>`;
  const phone = formatPhoneDisplay(booking.phone);
  const title = kind === "arrival" ? "СЬОГОДНІ ЗАЇЗД" : "СЬОГОДНІ ВИЇЗД";
  const details = buildDetails(booking, kind);

  return [
    `🛎 <b>${title} | ${escapeHtml(booking.cottage || "Котедж")}</b>`,
    "",
    `👤 ${escapeHtml(booking.name || "Гість")}${phone ? ` (${phone})` : ""}`,
    `📅 ${formatDateUk(booking.checkIn)} — ${formatDateUk(booking.checkOut)}`,
    "",
    "<b>Деталі:</b>",
    details,
    "",
    `💰 Загальна сума: <b>${formatMoneyUa(total)}</b>`,
    `✅ Внесено: <b>${formatMoneyUa(paid)}</b>`,
    balanceLine,
  ].join("\n");
}

type DayNotifyItem = {
  booking: ArrivalDepartureBooking;
  kind: "arrival" | "departure";
};

function collectTodayArrivalDepartureItems(
  bookings: ArrivalDepartureBooking[],
  today: string
): DayNotifyItem[] {
  const items: DayNotifyItem[] = [];
  for (const booking of bookings) {
    if (!isConfirmedBookingStatus(booking.status)) continue;
    const checkIn = toDateKeyKyiv(booking.checkIn);
    const checkOut = toDateKeyKyiv(booking.checkOut);
    const isArrival = checkIn === today;
    const isDeparture = checkOut === today;
    if (!isArrival && !isDeparture) continue;
    // Виїзд перед заїздом у тому ж будиночку (логіка обороту)
    if (isDeparture) items.push({ booking, kind: "departure" });
    if (isArrival) items.push({ booking, kind: "arrival" });
  }
  items.sort((a, b) => {
    const byCottage = compareByCottageNumber(a.booking.cottage, b.booking.cottage);
    if (byCottage !== 0) return byCottage;
    if (a.kind === b.kind) return 0;
    return a.kind === "departure" ? -1 : 1;
  });
  return items;
}

export async function notifyTodayArrivalsAndDepartures(
  bookings: ArrivalDepartureBooking[]
): Promise<{ arrivals: number; departures: number }> {
  if (!isTelegramConfigured()) {
    console.warn("[TG] Skipping arrival/departure notify — Telegram not configured");
    return { arrivals: 0, departures: 0 };
  }

  const today = todayKeyKyiv();
  const target = getArrivalsTargets();
  const keyboard = chessboardKeyboard();
  const items = collectTodayArrivalDepartureItems(bookings, today);
  let arrivals = 0;
  let departures = 0;

  if (items.length === 0) {
    return { arrivals: 0, departures: 0 };
  }

  const separator = await sendTelegramMessage(
    formatTelegramDaySeparator(),
    null,
    target.chatId,
    target.threadId
  );
  if (!separator.ok) {
    console.error(
      "[TG] day separator failed",
      await separator.text().catch(() => "")
    );
  }

  for (const item of items) {
    const res = await sendTelegramMessage(
      buildArrivalDepartureCaption(item.booking, item.kind),
      keyboard,
      target.chatId,
      target.threadId
    );
    if (res.ok) {
      if (item.kind === "arrival") arrivals += 1;
      else departures += 1;
    } else {
      console.error(
        `[TG] ${item.kind} notify failed`,
        await res.text().catch(() => "")
      );
    }
  }

  return { arrivals, departures };
}
