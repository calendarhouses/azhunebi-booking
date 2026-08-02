import { parseChildrenFromComment } from "@/components/admin/desktop/settings/additionalServicesLogic";
import { formatGuestsCompact } from "@/lib/public-booking/formatGuestsLabel";
import {
  getCleaningTargets,
  isCleaningConfigured,
  isTelegramConfigured,
} from "./config";
import {
  compareByCottageNumber,
  cottageSortNumber,
  isConfirmedBookingStatus,
  toDateKeyKyiv,
  todayKeyKyiv,
} from "./formatters";
import {
  deleteTelegramMessage,
  editTelegramMessage,
  sendTelegramMessageResult,
} from "./sendMessage";
import type { ArrivalDepartureBooking } from "./arrivalDepartureNotify";
import {
  fetchCleaningTelegramState,
  saveCleaningTelegramState,
  stateForToday,
  type CleaningTelegramMessageEntry,
  type CleaningTelegramState,
} from "./cleaningTelegramState";

/** Stable map key + display number: «Будиночок 7» / «7» → «7». */
export function cleaningCottageKey(cottage: string | undefined): string {
  const num = cottageSortNumber(cottage);
  if (Number.isFinite(num) && num !== Number.POSITIVE_INFINITY) {
    return String(num);
  }
  return String(cottage || "").trim();
}

function guestsFromBooking(booking: ArrivalDepartureBooking): {
  adults: number;
  children: number;
} {
  return {
    adults: Number(booking.guests) || 0,
    children: parseChildrenFromComment(booking.comment || ""),
  };
}

/** Сторона стрілки: «2+1», «4», або «0» якщо броні немає. */
export function formatCleaningGuestsSide(
  booking: ArrivalDepartureBooking | null | undefined
): string {
  if (!booking) return "0";
  const { adults, children } = guestsFromBooking(booking);
  const label = formatGuestsCompact(adults, children);
  return label === "—" ? "0" : label;
}

/**
 * Короткий наряд для групи ПРИБИРАННЯ:
 * ⛺️ 1
 * 2+1 ➡️  3+1
 */
export function buildCleaningTurnoverCaption(params: {
  cottage: string;
  departure?: ArrivalDepartureBooking | null;
  arrival?: ArrivalDepartureBooking | null;
}): string {
  const key = cleaningCottageKey(params.cottage);
  const from = formatCleaningGuestsSide(params.departure);
  const to = formatCleaningGuestsSide(params.arrival);
  return `⛺️ ${key}\n${from} ➡️  ${to}`;
}

/** @deprecated — старий довгий блок виїзду */
export function buildCleaningDepartureSection(
  booking: ArrivalDepartureBooking
): string {
  return buildCleaningTurnoverCaption({
    cottage: booking.cottage || "Котедж",
    departure: booking,
  });
}

/** @deprecated — старий довгий блок заїзду */
export function buildCleaningArrivalSection(
  booking: ArrivalDepartureBooking
): string {
  return buildCleaningTurnoverCaption({
    cottage: booking.cottage || "Котедж",
    arrival: booking,
  });
}

/** @deprecated */
export function buildCleaningNoArrivalSection(cottage: string): string {
  return buildCleaningTurnoverCaption({ cottage, departure: null, arrival: null });
}

/** @deprecated Use buildCleaningArrivalSection */
export function buildCleaningArrivalCaption(
  booking: ArrivalDepartureBooking
): string {
  return buildCleaningArrivalSection(booking);
}

export type CottageTurnover = {
  cottage: string;
  cottageKey: string;
  departure?: ArrivalDepartureBooking;
  arrival?: ArrivalDepartureBooking;
  text: string;
};

export function groupCleaningTurnoversByCottage(
  bookings: ArrivalDepartureBooking[],
  today: string
): CottageTurnover[] {
  const map = new Map<string, CottageTurnover>();

  for (const booking of bookings) {
    if (!isConfirmedBookingStatus(booking.status)) continue;
    const mapKey = cleaningCottageKey(booking.cottage);
    if (!mapKey) continue;

    const checkIn = toDateKeyKyiv(booking.checkIn);
    const checkOut = toDateKeyKyiv(booking.checkOut);
    const isArrival = checkIn === today;
    const isDeparture = checkOut === today;
    if (!isArrival && !isDeparture) continue;

    const entry =
      map.get(mapKey) ??
      ({
        cottage: String(booking.cottage || "").trim() || "Котедж",
        cottageKey: mapKey,
        text: "",
      } satisfies CottageTurnover);

    if (isDeparture && !entry.departure) entry.departure = booking;
    if (isArrival && !entry.arrival) entry.arrival = booking;
    map.set(mapKey, entry);
  }

  const list = [...map.values()].map((entry) => ({
    ...entry,
    text: buildCleaningTurnoverCaption({
      cottage: entry.cottageKey,
      departure: entry.departure,
      arrival: entry.arrival,
    }),
  }));

  return list.sort((a, b) => compareByCottageNumber(a.cottageKey, b.cottageKey));
}

export type CleaningSyncResult = {
  sent: number;
  edited: number;
  deleted: number;
  unchanged: number;
  errors: string[];
};

/**
 * Синхронізує повідомлення в групі ПРИБИРАННЯ з поточними заїздами/виїздами сьогодні:
 * — нова хата → send
 * — змінилась кількість → edit того ж повідомлення
 * — зникли і заїзд, і виїзд → delete
 */
export async function syncCleaningTodayTurnovers(
  bookings: ArrivalDepartureBooking[]
): Promise<CleaningSyncResult> {
  const result: CleaningSyncResult = {
    sent: 0,
    edited: 0,
    deleted: 0,
    unchanged: 0,
    errors: [],
  };

  if (!isTelegramConfigured() || !isCleaningConfigured()) {
    console.warn(
      "[TG] Skipping cleaning turnover sync — Telegram or cleaning chat not configured"
    );
    result.errors.push("telegram_not_configured");
    return result;
  }

  const today = todayKeyKyiv();
  const target = getCleaningTargets();
  const turnovers = groupCleaningTurnoversByCottage(bookings, today);
  const desired = new Map(turnovers.map((t) => [t.cottageKey, t]));

  let loaded: CleaningTelegramState;
  try {
    loaded = await fetchCleaningTelegramState();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[TG] fetchCleaningTelegramState failed", err);
    result.errors.push(`load_state:${msg}`);
    return result;
  }

  const next: CleaningTelegramState = stateForToday(
    loaded,
    today,
    target.chatId
  );
  const nextMessages: Record<string, CleaningTelegramMessageEntry> = {
    ...next.messages,
  };

  // Delete messages for cottages that no longer have arrival or departure today.
  for (const [key, entry] of Object.entries(nextMessages)) {
    if (desired.has(key)) continue;
    const del = await deleteTelegramMessage(target.chatId, entry.messageId);
    if (del.ok) {
      result.deleted += 1;
      delete nextMessages[key];
    } else {
      const err = del.description || "delete_failed";
      console.error("[TG] cleaning delete failed", key, err);
      result.errors.push(`delete:${key}:${err}`);
      // Drop tracking if message is already gone.
      if (/message to delete not found|message can't be deleted/i.test(err)) {
        delete nextMessages[key];
      }
    }
  }

  for (const turnover of turnovers) {
    const existing = nextMessages[turnover.cottageKey];
    if (existing) {
      if (existing.text === turnover.text) {
        result.unchanged += 1;
        continue;
      }
      const edited = await editTelegramMessage(
        target.chatId,
        existing.messageId,
        turnover.text
      );
      if (edited.ok) {
        result.edited += 1;
        nextMessages[turnover.cottageKey] = {
          messageId: existing.messageId,
          text: turnover.text,
        };
      } else {
        const err = edited.description || "edit_failed";
        console.error("[TG] cleaning edit failed", turnover.cottageKey, err);
        // Message missing → send a fresh one.
        if (/message to edit not found|message can't be edited/i.test(err)) {
          const sent = await sendTelegramMessageResult(
            turnover.text,
            undefined,
            target.chatId,
            target.threadId
          );
          if (sent.ok && sent.messageId) {
            result.sent += 1;
            nextMessages[turnover.cottageKey] = {
              messageId: sent.messageId,
              text: turnover.text,
            };
          } else {
            result.errors.push(
              `resend:${turnover.cottageKey}:${sent.description || "send_failed"}`
            );
            delete nextMessages[turnover.cottageKey];
          }
        } else {
          result.errors.push(`edit:${turnover.cottageKey}:${err}`);
        }
      }
      continue;
    }

    const sent = await sendTelegramMessageResult(
      turnover.text,
      undefined,
      target.chatId,
      target.threadId
    );
    if (sent.ok && sent.messageId) {
      result.sent += 1;
      nextMessages[turnover.cottageKey] = {
        messageId: sent.messageId,
        text: turnover.text,
      };
    } else {
      const err = sent.description || "send_failed";
      console.error("[TG] cleaning send failed", turnover.cottageKey, err);
      result.errors.push(`send:${turnover.cottageKey}:${err}`);
    }
  }

  try {
    await saveCleaningTelegramState({
      date: today,
      chatId: target.chatId,
      messages: nextMessages,
    });
  } catch (err) {
    console.error("[TG] saveCleaningTelegramState failed", err);
    result.errors.push(
      `save_state:${err instanceof Error ? err.message : String(err)}`
    );
  }

  return result;
}

/** Ранковий cron / ручне «Оновити» — той самий sync. */
export async function notifyCleaningTodayTurnovers(
  bookings: ArrivalDepartureBooking[]
): Promise<number> {
  const result = await syncCleaningTodayTurnovers(bookings);
  return result.sent + result.edited + result.unchanged;
}

/** @deprecated Use notifyCleaningTodayTurnovers */
export async function notifyCleaningTodayArrivals(
  bookings: ArrivalDepartureBooking[]
): Promise<number> {
  return notifyCleaningTodayTurnovers(bookings);
}
