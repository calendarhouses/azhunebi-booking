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
  escapeHtml,
  formatTelegramDaySeparator,
  isConfirmedBookingStatus,
  toDateKeyKyiv,
  todayKeyKyiv,
} from "./formatters";
import { sendTelegramMessage } from "./sendMessage";
import type { ArrivalDepartureBooking } from "./arrivalDepartureNotify";

function cottageKey(cottage: string | undefined): string {
  return String(cottage || "").trim().toLowerCase();
}

function guestsFromBooking(booking: ArrivalDepartureBooking): { adults: number; children: number } {
  return {
    adults: Number(booking.guests) || 0,
    children: parseChildrenFromComment(booking.comment || ""),
  };
}

/** Компактно: «2», «2+1», або «0» якщо броні/гостей немає. */
function guestsLabelOrZero(booking: ArrivalDepartureBooking | null | undefined): string {
  if (!booking) return "0";
  const { adults, children } = guestsFromBooking(booking);
  if (adults <= 0 && children <= 0) return "0";
  return formatGuestsCompact(adults, children);
}

/** «Будиночок 7» → «7»; без номера — повна назва. */
export function cleaningCottageLabel(cottage: string): string {
  const raw = String(cottage || "").trim() || "Котедж";
  const n = cottageSortNumber(raw);
  if (Number.isFinite(n) && n !== Number.POSITIVE_INFINITY) return String(n);
  return raw;
}

/**
 * Формат для чату прибирання:
 * ⛺️ 7
 *
 * 2+2 ➡️  0   — лише виїзд (заїзду немає)
 * 0 ➡️  2     — лише заїзд (виїзду немає)
 * 2+1 ➡️  3+1 — виїзд + заїзд
 */
export function buildCleaningTurnoverCaption(params: {
  cottage: string;
  departure?: ArrivalDepartureBooking | null;
  arrival?: ArrivalDepartureBooking | null;
}): string {
  const departure = params.departure ?? null;
  const arrival = params.arrival ?? null;
  if (!departure && !arrival) return "";

  const label = cleaningCottageLabel(params.cottage || "Котедж");
  const from = guestsLabelOrZero(departure);
  const to = guestsLabelOrZero(arrival);

  return `⛺️ ${escapeHtml(label)}\n\n${escapeHtml(from)} ➡️  ${escapeHtml(to)}`;
}

/** Усі будиночки одним дайджестом (як у прикладі з кількома ⛺️). */
export function buildCleaningTurnoversDigest(
  turnovers: Array<{
    cottage: string;
    departure?: ArrivalDepartureBooking | null;
    arrival?: ArrivalDepartureBooking | null;
  }>
): string {
  return turnovers
    .map((t) => buildCleaningTurnoverCaption(t))
    .filter(Boolean)
    .join("\n\n");
}

/** @deprecated Kept for older call sites / demos */
export function buildCleaningDepartureSection(booking: ArrivalDepartureBooking): string {
  return buildCleaningTurnoverCaption({
    cottage: booking.cottage || "Котедж",
    departure: booking,
  });
}

/** @deprecated Kept for older call sites / demos */
export function buildCleaningArrivalSection(booking: ArrivalDepartureBooking): string {
  return buildCleaningTurnoverCaption({
    cottage: booking.cottage || "Котедж",
    arrival: booking,
  });
}

/** @deprecated */
export function buildCleaningNoArrivalSection(cottage: string): string {
  return buildCleaningTurnoverCaption({
    cottage,
    // Fake non-null departure so caption renders «… ➡️  0»; callers should pass real booking.
    departure: { cottage, guests: 0, status: "Підтверджено" } as ArrivalDepartureBooking,
  });
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
    if (res.ok) sent += 1;
    else console.error("[TG] cleaning turnover notify failed", await res.text().catch(() => ""));
  }

  return sent;
}

/** @deprecated Use notifyCleaningTodayTurnovers */
export async function notifyCleaningTodayArrivals(
  bookings: ArrivalDepartureBooking[]
): Promise<number> {
  return notifyCleaningTodayTurnovers(bookings);
}
