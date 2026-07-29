import { parseChildrenFromComment } from "@/components/admin/desktop/settings/additionalServicesLogic";
import { formatGuestsCompact } from "@/lib/public-booking/formatGuestsLabel";
import {
  getCleaningTargets,
  isCleaningConfigured,
  isTelegramConfigured,
} from "./config";
import {
  compareByCottageNumber,
  escapeHtml,
  formatTelegramDaySeparator,
  isConfirmedBookingStatus,
  toDateKeyKyiv,
  todayKeyKyiv,
} from "./formatters";
import { sendTelegramMessage } from "./sendMessage";
import type { ArrivalDepartureBooking } from "./arrivalDepartureNotify";
import { upsertTelegramTurnoversState, type TelegramMessageRef } from "./turnoversState";

function cottageKey(cottage: string | undefined): string {
  return String(cottage || "").trim().toLowerCase();
}

function guestsFromBooking(booking: ArrivalDepartureBooking): { adults: number; children: number } {
  return {
    adults: Number(booking.guests) || 0,
    children: parseChildrenFromComment(booking.comment || ""),
  };
}

export function buildCleaningDepartureSection(booking: ArrivalDepartureBooking): string {
  const cottage = booking.cottage || "Котедж";
  const { adults, children } = guestsFromBooking(booking);
  const guestsLabel = formatGuestsCompact(adults, children);

  return [
    `🛎 <b>СЬОГОДНІ ВИЇЗД | ${escapeHtml(cottage)}</b>`,
    "",
    "<b>ДЕТАЛІ:</b>",
    `👥 Було ${escapeHtml(guestsLabel)}`,
  ].join("\n");
}

export function buildCleaningArrivalSection(booking: ArrivalDepartureBooking): string {
  const cottage = booking.cottage || "Котедж";
  const { adults, children } = guestsFromBooking(booking);
  const guestsLabel = formatGuestsCompact(adults, children);

  return [
    `🛎 <b>СЬОГОДНІ ЗАЇЗД | ${escapeHtml(cottage)}</b>`,
    "",
    "<b>ДЕТАЛІ:</b>",
    `👥 буде ${escapeHtml(guestsLabel)}`,
  ].join("\n");
}

export function buildCleaningNoArrivalSection(cottage: string): string {
  return `🛎 <b>СЬОГОДНІ ЗАЇЗДУ НЕМАЄ | ${escapeHtml(cottage)}</b>`;
}

/** Одне сповіщення для чату прибирання на будинок (виїзд / заїзд / обидва). */
export function buildCleaningTurnoverCaption(params: {
  cottage: string;
  departure?: ArrivalDepartureBooking | null;
  arrival?: ArrivalDepartureBooking | null;
}): string {
  const cottage = params.cottage || "Котедж";
  const departure = params.departure ?? null;
  const arrival = params.arrival ?? null;

  if (departure && arrival) {
    return [buildCleaningDepartureSection(departure), buildCleaningArrivalSection(arrival)].join("\n\n");
  }
  if (departure) {
    return [buildCleaningDepartureSection(departure), buildCleaningNoArrivalSection(cottage)].join("\n\n");
  }
  if (arrival) {
    return buildCleaningArrivalSection(arrival);
  }
  return "";
}

/** @deprecated Use buildCleaningArrivalSection — kept for demo imports */
export function buildCleaningArrivalCaption(booking: ArrivalDepartureBooking): string {
  return buildCleaningArrivalSection(booking);
}

type CottageTurnover = {
  cottage: string;
  departure?: ArrivalDepartureBooking;
  arrival?: ArrivalDepartureBooking;
};

export function groupCleaningTurnoversByCottage(
  bookings: ArrivalDepartureBooking[],
  today: string
): CottageTurnover[] {
  const map = new Map<string, CottageTurnover>();

  for (const booking of bookings) {
    if (!isConfirmedBookingStatus(booking.status)) continue;
    const key = cottageKey(booking.cottage);
    if (!key) continue;

    const checkIn = toDateKeyKyiv(booking.checkIn);
    const checkOut = toDateKeyKyiv(booking.checkOut);
    const isArrival = checkIn === today;
    const isDeparture = checkOut === today;
    if (!isArrival && !isDeparture) continue;

    const entry = map.get(key) ?? { cottage: String(booking.cottage || "").trim() || "Котедж" };
    if (isDeparture && !entry.departure) entry.departure = booking;
    if (isArrival && !entry.arrival) entry.arrival = booking;
    map.set(key, entry);
  }

  return [...map.values()].sort((a, b) => compareByCottageNumber(a.cottage, b.cottage));
}

export async function notifyCleaningTodayTurnovers(
  bookings: ArrivalDepartureBooking[]
): Promise<number> {
  if (!isTelegramConfigured() || !isCleaningConfigured()) {
    console.warn("[TG] Skipping cleaning turnover notify — Telegram or cleaning chat not configured");
    return 0;
  }

  const today = todayKeyKyiv();
  const target = getCleaningTargets();
  const turnovers = groupCleaningTurnoversByCottage(bookings, today);
  if (turnovers.length === 0) return 0;

  const statePatch: { cleaning?: Record<string, TelegramMessageRef> } = {};

  const separator = await sendTelegramMessage(
    formatTelegramDaySeparator(),
    undefined,
    target.chatId,
    target.threadId
  );
  if (!separator.ok) {
    console.error(
      "[TG] cleaning day separator failed",
      await separator.text().catch(() => "")
    );
  }

  let sent = 0;
  for (const turnover of turnovers) {
    const caption = buildCleaningTurnoverCaption(turnover);
    if (!caption) continue;

    const res = await sendTelegramMessage(
      caption,
      undefined,
      target.chatId,
      target.threadId
    );
    if (res.ok) {
      const json = await res.json().catch(() => null);
      const messageId = json?.result?.message_id;
      const chatId = json?.result?.chat?.id ?? target.chatId;
      const cKey = String(turnover.cottage || "").trim().toLowerCase();
      if (
        cKey &&
        typeof messageId === "number"
      ) {
        statePatch.cleaning = statePatch.cleaning || {};
        statePatch.cleaning[cKey] = { chatId, messageId };
      }
      sent += 1;
    } else {
      console.error("[TG] cleaning turnover notify failed", await res.text().catch(() => ""));
    }
  }

  if (statePatch.cleaning && Object.keys(statePatch.cleaning).length > 0) {
    await upsertTelegramTurnoversState(today, statePatch);
  }

  return sent;
}

/** @deprecated Use notifyCleaningTodayTurnovers */
export async function notifyCleaningTodayArrivals(
  bookings: ArrivalDepartureBooking[]
): Promise<number> {
  return notifyCleaningTodayTurnovers(bookings);
}
