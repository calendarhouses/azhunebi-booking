import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin/verifyAdminRequest";
import { fetchCronTelegramDigest } from "@/lib/telegram/cronDigest";
import {
  buildArrivalDepartureCaption,
  type ArrivalDepartureBooking,
} from "@/lib/telegram/arrivalDepartureNotify";
import {
  buildCleaningTurnoverCaption,
  groupCleaningTurnoversByCottage,
} from "@/lib/telegram/cleaningArrivalNotify";
import {
  isConfirmedBookingStatus,
  toDateKeyKyiv,
  todayKeyKyiv,
  compareByCottageNumber,
} from "@/lib/telegram/formatters";
import { chessboardKeyboard, getArrivalsTargets, getCleaningTargets, isTelegramConfigured } from "@/lib/telegram/config";
import { editTelegramMessage, sendTelegramMessage } from "@/lib/telegram/sendMessage";
import {
  upsertTelegramTurnoversState,
  type TelegramMessageRef,
  type TelegramTurnoversState,
  type TelegramTurnoversStatePatch,
} from "@/lib/telegram/turnoversState";

export const runtime = "nodejs";

type RefreshResult = {
  ok: boolean;
  edited: number;
  sent: number;
  updatedDay: string;
};

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

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id")?.trim() || null;
  const auth = await verifyAdminRequest(request, tenantId);
  if (auth instanceof NextResponse) return auth;

  if (!isTelegramConfigured()) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_NOT_CONFIGURED" }, { status: 503 });
  }

  const digest = await fetchCronTelegramDigest();
  const bookings = (digest.bookings || []) as ArrivalDepartureBooking[];
  const settings = digest.settings || {};

  const updatedDay = todayKeyKyiv();
  const storedState = safeParseTelegramTurnoversState(
    (settings as Record<string, unknown>)["telegramTurnoversState"]
  );

  const dayState = storedState[updatedDay] || {};
  const storedArrivals = dayState.arrivals || {};
  const storedDepartures = dayState.departures || {};
  const storedCleaning = dayState.cleaning || {};

  const arrivalsTargets = getArrivalsTargets();
  const cleaningTargets = getCleaningTargets();
  const keyboard = chessboardKeyboard();

  const arrivalItems = collectTodayArrivalDepartureItems(bookings, updatedDay);
  const turnovers = groupCleaningTurnoversByCottage(bookings, updatedDay);

  let edited = 0;
  let sent = 0;

  const patch: TelegramTurnoversStatePatch = {};

  // Build a set of current booking+kind combos so we know which stored refs are stale.
  const currentArrivalIds = new Set<string>();
  const currentDepartureIds = new Set<string>();

  for (const item of arrivalItems) {
    const bId = bookingIdKey(item.booking);
    if (!bId) continue;
    if (item.kind === "arrival") currentArrivalIds.add(bId);
    else currentDepartureIds.add(bId);

    const caption = buildArrivalDepartureCaption(item.booking, item.kind);
    const kindMap = item.kind === "arrival" ? storedArrivals : storedDepartures;
    const ref = kindMap[bId] as TelegramMessageRef | undefined;

    if (ref?.messageId != null) {
      // Already have a message — edit it with fresh data.
      await editTelegramMessage(
        ref.chatId ?? arrivalsTargets.chatId,
        ref.messageId,
        caption,
        keyboard
      ).catch(() => undefined);
      edited += 1;
    } else {
      // New booking that wasn't sent yet — send once and persist message_id.
      const res = await sendTelegramMessage(
        caption,
        keyboard,
        arrivalsTargets.chatId,
        arrivalsTargets.threadId
      );
      const newRef = await extractRef(res, arrivalsTargets.chatId);
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

  // Cleaning turnovers
  const currentCottageKeys = new Set(turnovers.map((t) => cottageKey(t.cottage)));

  for (const turnover of turnovers) {
    const cKey = cottageKey(turnover.cottage);
    if (!cKey) continue;

    const caption = buildCleaningTurnoverCaption(turnover);
    const ref = storedCleaning[cKey] as TelegramMessageRef | undefined;

    if (ref?.messageId != null) {
      await editTelegramMessage(ref.chatId ?? cleaningTargets.chatId, ref.messageId, caption).catch(() => undefined);
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
    await editTelegramMessage(ref.chatId ?? cleaningTargets.chatId, ref.messageId, caption).catch(() => undefined);
    edited += 1;
  }

  // Persist new message_ids so next refresh will edit instead of send.
  if (Object.keys(patch).length > 0) {
    await upsertTelegramTurnoversState(updatedDay, patch);
  }

  const result: RefreshResult = {
    ok: true,
    edited,
    sent,
    updatedDay,
  };

  return NextResponse.json(result);
}
