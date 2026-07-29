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

/**
 * Refresh today's arrival/departure/cleaning Telegram messages.
 *
 * editOnly=true  → only edit messages we already have message_id for (manual button).
 * editOnly=false → also send new messages for bookings without stored message_id,
 *                  then persist the new message_ids (auto-trigger).
 */
export async function refreshTurnoversTelegramMessages(args: {
  bookings: ArrivalDepartureBooking[];
  settings: Record<string, unknown>;
  editOnly?: boolean;
}): Promise<{ edited: number; sent: number; skipped: number; updatedDay: string }> {
  if (!isTelegramConfigured()) {
    return { edited: 0, sent: 0, skipped: 0, updatedDay: todayKeyKyiv() };
  }

  const { bookings, settings, editOnly = false } = args;
  const updatedDay = todayKeyKyiv();
  const storedState = safeParse(settings.telegramTurnoversState);

  const dayState = storedState[updatedDay] || {};
  const storedArrivals = dayState.arrivals || {};
  const storedDepartures = dayState.departures || {};
  const storedCleaning = dayState.cleaning || {};

  const arrivalTargets = getArrivalsTargets();
  const cleaningTargets = getCleaningTargets();
  const keyboard = chessboardKeyboard();

  const arrivalItems = collectItems(bookings, updatedDay);
  const turnovers = groupCleaningTurnoversByCottage(bookings, updatedDay);

  let edited = 0;
  let sent = 0;
  let skipped = 0;

  const patch: TelegramTurnoversStatePatch = {};

  for (const item of arrivalItems) {
    const bId = bKey(item.booking);
    if (!bId) continue;

    const caption = buildArrivalDepartureCaption(item.booking, item.kind);
    const kindMap = item.kind === "arrival" ? storedArrivals : storedDepartures;
    const ref = kindMap[bId] as TelegramMessageRef | undefined;

    if (ref?.messageId != null) {
      await editTelegramMessage(
        ref.chatId ?? arrivalTargets.chatId, ref.messageId, caption, keyboard
      ).catch(() => undefined);
      edited += 1;
    } else if (!editOnly) {
      const res = await sendTelegramMessage(caption, keyboard, arrivalTargets.chatId, arrivalTargets.threadId);
      const nr = await extractRef(res, arrivalTargets.chatId);
      if (nr) {
        sent += 1;
        const bucket = item.kind === "arrival" ? "arrivals" : "departures";
        patch[bucket] = patch[bucket] || {};
        patch[bucket]![bId] = nr;
      }
    } else {
      skipped += 1;
    }
  }

  const currentCottages = new Set(turnovers.map((t) => cKey(t.cottage)));

  for (const turnover of turnovers) {
    const ck = cKey(turnover.cottage);
    if (!ck) continue;
    const caption = buildCleaningTurnoverCaption(turnover);
    const ref = storedCleaning[ck] as TelegramMessageRef | undefined;

    if (ref?.messageId != null) {
      await editTelegramMessage(ref.chatId ?? cleaningTargets.chatId, ref.messageId, caption).catch(() => undefined);
      edited += 1;
    } else if (!editOnly) {
      const res = await sendTelegramMessage(caption, undefined, cleaningTargets.chatId, cleaningTargets.threadId);
      const nr = await extractRef(res, cleaningTargets.chatId);
      if (nr) {
        sent += 1;
        patch.cleaning = patch.cleaning || {};
        patch.cleaning[ck] = nr;
      }
    } else {
      skipped += 1;
    }
  }

  // Stale cleaning messages
  for (const [ck, ref] of Object.entries(storedCleaning)) {
    if (!ref?.messageId) continue;
    if (currentCottages.has(ck)) continue;
    await editTelegramMessage(
      ref.chatId ?? cleaningTargets.chatId, ref.messageId,
      `🛎 <b>СЬОГОДНІ ПОВОРОТІВ НЕМАЄ | ${ck}</b>`
    ).catch(() => undefined);
    edited += 1;
  }

  if (Object.keys(patch).length > 0) {
    await upsertTelegramTurnoversState(updatedDay, patch);
  }

  return { edited, sent, skipped, updatedDay };
}

function bKey(b: ArrivalDepartureBooking): string | null {
  const id = String(b.id || "").trim();
  return id || null;
}

function cKey(cottage: unknown): string {
  return String(cottage || "").trim().toLowerCase();
}

function collectItems(
  bookings: ArrivalDepartureBooking[], today: string
): Array<{ booking: ArrivalDepartureBooking; kind: "arrival" | "departure" }> {
  const items: Array<{ booking: ArrivalDepartureBooking; kind: "arrival" | "departure" }> = [];
  for (const booking of bookings) {
    if (!isConfirmedBookingStatus(booking.status)) continue;
    const ci = toDateKeyKyiv(booking.checkIn);
    const co = toDateKeyKyiv(booking.checkOut);
    if (co === today) items.push({ booking, kind: "departure" });
    if (ci === today) items.push({ booking, kind: "arrival" });
  }
  items.sort((a, b) => {
    const d = compareByCottageNumber(a.booking.cottage, b.booking.cottage);
    return d !== 0 ? d : a.kind === b.kind ? 0 : a.kind === "departure" ? -1 : 1;
  });
  return items;
}

function safeParse(raw: unknown): TelegramTurnoversState {
  if (!raw) return {};
  if (typeof raw === "object") return raw as TelegramTurnoversState;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === "object") return p as TelegramTurnoversState;
    } catch { /* ignore */ }
  }
  return {};
}

async function extractRef(res: Response, fallback: string | number): Promise<TelegramMessageRef | null> {
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  const mid = json?.result?.message_id;
  const cid = json?.result?.chat?.id ?? fallback;
  return typeof mid === "number" && cid != null ? { chatId: cid, messageId: mid } : null;
}
