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
import {
  chessboardKeyboard,
  getArrivalsTargets,
  getCleaningTargets,
  isCleaningConfigured,
  isTelegramConfigured,
} from "./config";
import {
  deleteTelegramMessage,
  editTelegramMessage,
  sendTelegramMessage,
} from "./sendMessage";
import {
  readTelegramTurnoversState,
  upsertTelegramTurnoversState,
  type TelegramMessageRef,
  type TelegramTurnoversState,
  type TelegramTurnoversStatePatch,
} from "./turnoversState";

/**
 * Refresh today's arrival/departure/cleaning Telegram messages.
 *
 * editOnly=true  → only edit messages we already have message_id for.
 * editOnly=false → also send new messages for bookings without stored message_id,
 *                  then persist the new message_ids (manual button + cron).
 */
export async function refreshTurnoversTelegramMessages(args: {
  bookings: ArrivalDepartureBooking[];
  settings: Record<string, unknown>;
  editOnly?: boolean;
}): Promise<{
  edited: number;
  sent: number;
  skipped: number;
  deleted: number;
  updatedDay: string;
  telegramTurnoversState: TelegramTurnoversState;
}> {
  const updatedDay = todayKeyKyiv();
  const storedState = readTelegramTurnoversState(args.settings);

  if (!isTelegramConfigured()) {
    return {
      edited: 0,
      sent: 0,
      skipped: 0,
      deleted: 0,
      updatedDay,
      telegramTurnoversState: storedState,
    };
  }

  const { bookings, editOnly = false } = args;
  const dayState = { ...(storedState[updatedDay] || {}) };
  const storedArrivals = { ...(dayState.arrivals || {}) };
  const storedDepartures = { ...(dayState.departures || {}) };
  const storedCleaning = { ...(dayState.cleaning || {}) };

  const arrivalTargets = getArrivalsTargets();
  const cleaningTargets = getCleaningTargets();
  const keyboard = chessboardKeyboard();
  const cleaningEnabled = isCleaningConfigured();

  const arrivalItems = collectItems(bookings, updatedDay);
  const turnovers = cleaningEnabled
    ? groupCleaningTurnoversByCottage(bookings, updatedDay)
    : [];

  let edited = 0;
  let sent = 0;
  let skipped = 0;
  let deleted = 0;

  const patch: TelegramTurnoversStatePatch = {};

  const currentArrivalIds = new Set<string>();
  const currentDepartureIds = new Set<string>();

  for (const item of arrivalItems) {
    const bId = bKey(item.booking);
    if (!bId) continue;
    if (item.kind === "arrival") currentArrivalIds.add(bId);
    else currentDepartureIds.add(bId);

    const caption = buildArrivalDepartureCaption(item.booking, item.kind);
    const kindMap = item.kind === "arrival" ? storedArrivals : storedDepartures;
    const ref = kindMap[bId] as TelegramMessageRef | undefined;

    if (ref?.messageId != null) {
      try {
        await editTelegramMessage(
          ref.chatId ?? arrivalTargets.chatId,
          ref.messageId,
          caption,
          keyboard
        );
        edited += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("not modified")) {
          edited += 1;
          continue;
        }
        if (!editOnly) {
          const nr = await sendAndCapture(
            caption,
            keyboard,
            arrivalTargets.chatId,
            arrivalTargets.threadId
          );
          if (nr) {
            sent += 1;
            const bucket = item.kind === "arrival" ? "arrivals" : "departures";
            patch[bucket] = patch[bucket] || {};
            patch[bucket]![bId] = nr;
            if (item.kind === "arrival") storedArrivals[bId] = nr;
            else storedDepartures[bId] = nr;
          }
        }
      }
    } else if (!editOnly) {
      const nr = await sendAndCapture(
        caption,
        keyboard,
        arrivalTargets.chatId,
        arrivalTargets.threadId
      );
      if (nr) {
        sent += 1;
        const bucket = item.kind === "arrival" ? "arrivals" : "departures";
        patch[bucket] = patch[bucket] || {};
        patch[bucket]![bId] = nr;
        if (item.kind === "arrival") storedArrivals[bId] = nr;
        else storedDepartures[bId] = nr;
      }
    } else {
      skipped += 1;
    }
  }

  for (const [bId, ref] of Object.entries(storedArrivals)) {
    if (!ref?.messageId) continue;
    if (currentArrivalIds.has(bId)) continue;
    await deleteTelegramMessage(ref.chatId ?? arrivalTargets.chatId, ref.messageId).catch(
      () => undefined
    );
    patch.arrivals = patch.arrivals || {};
    patch.arrivals[bId] = null;
    delete storedArrivals[bId];
    deleted += 1;
  }

  for (const [bId, ref] of Object.entries(storedDepartures)) {
    if (!ref?.messageId) continue;
    if (currentDepartureIds.has(bId)) continue;
    await deleteTelegramMessage(ref.chatId ?? arrivalTargets.chatId, ref.messageId).catch(
      () => undefined
    );
    patch.departures = patch.departures || {};
    patch.departures[bId] = null;
    delete storedDepartures[bId];
    deleted += 1;
  }

  if (cleaningEnabled) {
    const currentCottages = new Set(turnovers.map((t) => cKey(t.cottage)));

    for (const turnover of turnovers) {
      const ck = cKey(turnover.cottage);
      if (!ck) continue;
      const caption = buildCleaningTurnoverCaption(turnover);
      if (!caption) continue;
      const ref = storedCleaning[ck] as TelegramMessageRef | undefined;

      if (ref?.messageId != null) {
        try {
          await editTelegramMessage(
            ref.chatId ?? cleaningTargets.chatId,
            ref.messageId,
            caption
          );
          edited += 1;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.toLowerCase().includes("not modified")) {
            edited += 1;
            continue;
          }
          if (!editOnly) {
            const nr = await sendAndCapture(
              caption,
              undefined,
              cleaningTargets.chatId,
              cleaningTargets.threadId
            );
            if (nr) {
              sent += 1;
              patch.cleaning = patch.cleaning || {};
              patch.cleaning[ck] = nr;
              storedCleaning[ck] = nr;
            }
          }
        }
      } else if (!editOnly) {
        const nr = await sendAndCapture(
          caption,
          undefined,
          cleaningTargets.chatId,
          cleaningTargets.threadId
        );
        if (nr) {
          sent += 1;
          patch.cleaning = patch.cleaning || {};
          patch.cleaning[ck] = nr;
          storedCleaning[ck] = nr;
        }
      } else {
        skipped += 1;
      }
    }

    for (const [ck, ref] of Object.entries(storedCleaning)) {
      if (!ref?.messageId) continue;
      if (currentCottages.has(ck)) continue;
      await deleteTelegramMessage(ref.chatId ?? cleaningTargets.chatId, ref.messageId).catch(
        () => undefined
      );
      patch.cleaning = patch.cleaning || {};
      patch.cleaning[ck] = null;
      delete storedCleaning[ck];
      deleted += 1;
    }
  }

  let nextState: TelegramTurnoversState = { ...storedState };
  nextState[updatedDay] = {
    arrivals: storedArrivals,
    departures: storedDepartures,
    cleaning: storedCleaning,
  };

  if (Object.keys(patch).length > 0) {
    try {
      nextState = await upsertTelegramTurnoversState(updatedDay, patch);
    } catch (err) {
      console.warn("[TG turnovers] state upsert failed", err);
    }
  }

  return {
    edited,
    sent,
    skipped,
    deleted,
    updatedDay,
    telegramTurnoversState: nextState,
  };
}

function bKey(b: ArrivalDepartureBooking): string | null {
  const id = String(b.id || "").trim();
  return id || null;
}

function cKey(cottage: unknown): string {
  return String(cottage || "").trim().toLowerCase();
}

function collectItems(
  bookings: ArrivalDepartureBooking[],
  today: string
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

async function sendAndCapture(
  text: string,
  keyboard: unknown,
  chatId: string,
  threadId?: number | null
): Promise<TelegramMessageRef | null> {
  const res = await sendTelegramMessage(text, keyboard, chatId, threadId);
  if (!res.ok) {
    console.error("[TG refresh] send failed", await res.text().catch(() => ""));
    return null;
  }
  const json = (await res.json().catch(() => null)) as {
    result?: { message_id?: number; chat?: { id?: string | number } };
  } | null;
  const mid = json?.result?.message_id;
  const cid = json?.result?.chat?.id ?? chatId;
  return typeof mid === "number" ? { chatId: cid, messageId: mid } : null;
}
