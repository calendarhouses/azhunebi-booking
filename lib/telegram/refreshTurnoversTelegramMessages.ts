import {
  buildArrivalDepartureCaption,
  type ArrivalDepartureBooking,
} from "./arrivalDepartureNotify";
import {
  buildCleaningTurnoverCaption,
  groupCleaningTurnoversByCottage,
} from "./cleaningArrivalNotify";
import {
  compareByCottageNumber,
  isConfirmedBookingStatus,
  toDateKeyKyiv,
  todayKeyKyiv,
} from "./formatters";
import { chessboardKeyboard, getArrivalsTargets, getCleaningTargets, isTelegramConfigured } from "./config";
import { editTelegramMessage } from "./sendMessage";
import { type TelegramMessageRef, type TelegramTurnoversState } from "./turnoversState";

export async function refreshTurnoversTelegramMessages(args: {
  bookings: ArrivalDepartureBooking[];
  settings: Record<string, unknown>;
}): Promise<{ edited: number; sent: number; updatedDay: string }> {
  if (!isTelegramConfigured()) {
    return { edited: 0, sent: 0, updatedDay: todayKeyKyiv() };
  }

  const { bookings, settings } = args;
  const updatedDay = todayKeyKyiv();
  const storedState = safeParseTelegramTurnoversState(
    (settings as any).telegramTurnoversState
  );

  const dayState = storedState[updatedDay] || {};
  const storedArrivals = dayState.arrivals || {};
  const storedDepartures = dayState.departures || {};
  const storedCleaning = dayState.cleaning || {};

  const arrivalTargets = getArrivalsTargets();
  const cleaningTargets = getCleaningTargets();
  const keyboard = chessboardKeyboard();

  const arrivalItems = collectTodayArrivalDepartureItems(
    bookings,
    updatedDay
  );
  const turnovers = groupCleaningTurnoversByCottage(bookings, updatedDay);

  let edited = 0;

  for (const item of arrivalItems) {
    const bId = bookingIdKey(item.booking);
    if (!bId) continue;

    const caption = buildArrivalDepartureCaption(item.booking, item.kind);
    const kindMap =
      item.kind === "arrival" ? storedArrivals : storedDepartures;
    const ref = kindMap[bId] as TelegramMessageRef | undefined;

    if (ref?.messageId != null) {
      await editTelegramMessage(
        ref.chatId ?? arrivalTargets.chatId,
        ref.messageId,
        caption,
        keyboard
      ).catch(() => undefined);
      edited += 1;
      continue;
    }
    // Edit-only mode: if we don't have saved message ids, do not send a new message.
    // This prevents duplicates when refreshes overlap.
  }

  // Cleaning: edit both current and stale stored cottages for this day.
  const currentCottageKeys = new Set(turnovers.map((t) => cottageKey(t.cottage)));

  for (const turnover of turnovers) {
    const cKey = cottageKey(turnover.cottage);
    if (!cKey) continue;

    const caption = buildCleaningTurnoverCaption(turnover);
    const ref = storedCleaning[cKey] as TelegramMessageRef | undefined;
    if (ref?.messageId != null) {
      await editTelegramMessage(
        ref.chatId ?? cleaningTargets.chatId,
        ref.messageId,
        caption
      ).catch(() => undefined);
      edited += 1;
      continue;
    }
    // Edit-only mode: skip sending if we don't have saved refs.
  }

  // Stale cleaning messages: cottage no longer has turnovers today.
  for (const [cKey, ref] of Object.entries(storedCleaning)) {
    if (!ref?.messageId) continue;
    if (currentCottageKeys.has(cKey)) continue;

    const caption = `🛎 <b>СЬОГОДНІ ПОВОРОТІВ НЕМАЄ | ${cKey}</b>`;
    await editTelegramMessage(
      ref.chatId ?? cleaningTargets.chatId,
      ref.messageId,
      caption
    ).catch(() => undefined);
    edited += 1;
  }

  return { edited, sent: 0, updatedDay };
}

function bookingIdKey(booking: ArrivalDepartureBooking): string | null {
  const id = String(booking.id || "").trim();
  return id ? id : null;
}

function cottageKey(cottage: unknown): string {
  return String(cottage || "")
    .trim()
    .toLowerCase();
}

function collectTodayArrivalDepartureItems(
  bookings: ArrivalDepartureBooking[],
  today: string
): Array<{ booking: ArrivalDepartureBooking; kind: "arrival" | "departure" }> {
  const items: Array<{ booking: ArrivalDepartureBooking; kind: "arrival" | "departure" }> = [];
  for (const booking of bookings) {
    if (!isConfirmedBookingStatus(booking.status)) continue;
    const checkIn = toDateKeyKyiv(booking.checkIn);
    const checkOut = toDateKeyKyiv(booking.checkOut);
    const isArrival = checkIn === today;
    const isDeparture = checkOut === today;
    if (!isArrival && !isDeparture) continue;
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

function safeParseTelegramTurnoversState(raw: unknown): TelegramTurnoversState {
  if (!raw) return {};
  if (typeof raw === "object") return raw as TelegramTurnoversState;
  // In case sheet parsing returned a raw string value, try to recover once.
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as TelegramTurnoversState;
    } catch {
      // ignore
    }
  }
  return {};
}

