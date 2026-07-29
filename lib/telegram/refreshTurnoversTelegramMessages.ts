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
import { editTelegramMessage, sendTelegramMessage } from "./sendMessage";
import {
  upsertTelegramTurnoversState,
  type TelegramMessageRef,
  type TelegramTurnoversState,
  type TelegramTurnoversStatePatch,
} from "./turnoversState";

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

  const arrivalItems = collectTodayArrivalDepartureItems(bookings, updatedDay);
  const turnovers = groupCleaningTurnoversByCottage(bookings, updatedDay);

  let edited = 0;
  let sent = 0;

  const patch: TelegramTurnoversStatePatch = {};

  for (const item of arrivalItems) {
    const bId = bookingIdKey(item.booking);
    if (!bId) continue;

    const caption = buildArrivalDepartureCaption(item.booking, item.kind);
    const kindMap = item.kind === "arrival" ? storedArrivals : storedDepartures;
    const ref = kindMap[bId] as TelegramMessageRef | undefined;

    if (ref?.messageId != null) {
      await editTelegramMessage(
        ref.chatId ?? arrivalTargets.chatId,
        ref.messageId,
        caption,
        keyboard
      ).catch(() => undefined);
      edited += 1;
    } else {
      // New booking — send once and persist message_id for future edits.
      const res = await sendTelegramMessage(
        caption,
        keyboard,
        arrivalTargets.chatId,
        arrivalTargets.threadId
      );
      const newRef = await extractRef(res, arrivalTargets.chatId);
      if (newRef) {
        sent += 1;
        if (item.kind === "arrival") {
          patch.arrivals = patch.arrivals || {};
          patch.arrivals[bId] = newRef;
        } else {
          patch.departures = patch.departures || {};
          patch.departures[bId] = newRef;
        }
      }
    }
  }

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
    } else {
      const res = await sendTelegramMessage(caption, undefined, cleaningTargets.chatId, cleaningTargets.threadId);
      const newRef = await extractRef(res, cleaningTargets.chatId);
      if (newRef) {
        sent += 1;
        patch.cleaning = patch.cleaning || {};
        patch.cleaning[cKey] = newRef;
      }
    }
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

  // Persist new message_ids so next refresh will edit instead of send.
  if (Object.keys(patch).length > 0) {
    await upsertTelegramTurnoversState(updatedDay, patch);
  }

  return { edited, sent, updatedDay };
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

async function extractRef(
  res: Response,
  fallbackChatId: string | number
): Promise<TelegramMessageRef | null> {
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  const messageId = json?.result?.message_id;
  const chatId = json?.result?.chat?.id ?? fallbackChatId;
  if (typeof messageId === "number" && chatId != null) {
    return { chatId, messageId };
  }
  return null;
}
