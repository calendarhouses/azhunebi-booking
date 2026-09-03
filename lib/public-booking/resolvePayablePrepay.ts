import { parseSafeDate } from "@/components/admin/desktop/adminDates";
import { findRoomForBooking } from "@/lib/admin/roomBookingMatch";
import { loadAllSettings } from "@/lib/db/settings";
import {
  buildStayNightlyBasePrices,
  calculatePrepaymentAmount,
  readPrepaymentPolicy,
} from "@/lib/public-booking/prepaymentPolicy";
import type { PublicBranding } from "@/lib/public-booking/types";

type PayableBooking = {
  prepayAmount?: unknown;
  totalPrice?: unknown;
  basePrice?: unknown;
  checkIn?: unknown;
  checkOut?: unknown;
  roomId?: unknown;
  cottage?: unknown;
  assignmentState?: unknown;
};

function nightsBetween(booking: PayableBooking): number {
  const checkIn = parseSafeDate(String(booking.checkIn || ""));
  const checkOut = parseSafeDate(String(booking.checkOut || ""));
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) return 1;
  return Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000));
}

/**
 * Amount to charge as «передплата» on /pay and Mono invoices.
 * Stored field wins when set; otherwise the same policy as the admin chip
 * (nights = first N tariff nights, not an average / 50% of total).
 */
export function resolvePayablePrepayAmount(
  booking: PayableBooking,
  branding?: PublicBranding | null,
  opts?: {
    nightlyBasePrices?: number[];
    basePriceTotal?: number;
  }
): number {
  const total = Math.round(Number(booking.totalPrice) || 0);
  const stored = Math.round(Number(booking.prepayAmount) || 0);
  if (stored > 0) return total > 0 ? Math.min(stored, total) : stored;
  if (total <= 0) return 0;

  const policy = readPrepaymentPolicy(branding);
  if (policy.value <= 0) return 0;

  const nights = nightsBetween(booking);
  const baseFromField = Math.round(Number(booking.basePrice) || 0);
  const nightlySum = (opts?.nightlyBasePrices || []).reduce(
    (sum, n) => sum + Math.max(0, Math.round(Number(n) || 0)),
    0
  );
  const basePriceTotal =
    (opts?.basePriceTotal && opts.basePriceTotal > 0
      ? opts.basePriceTotal
      : 0) ||
    (baseFromField > 0 ? baseFromField : 0) ||
    (nightlySum > 0 ? nightlySum : total);

  const fromPolicy = calculatePrepaymentAmount(policy, {
    totalPrice: total,
    basePriceTotal,
    nights,
    nightlyBasePrices: opts?.nightlyBasePrices,
  });
  if (fromPolicy > 0) return Math.min(total, fromPolicy);
  return 0;
}

export async function resolvePayablePrepayAmountFromSettings(
  booking: PayableBooking
): Promise<number> {
  const all = await loadAllSettings();
  const branding =
    all.branding && typeof all.branding === "object" && !Array.isArray(all.branding)
      ? (all.branding as PublicBranding)
      : null;
  const rooms = Array.isArray(all.roomsList) ? all.roomsList : [];
  const customPrices =
    all.customPrices && typeof all.customPrices === "object" && !Array.isArray(all.customPrices)
      ? (all.customPrices as Record<string, Record<string, number>>)
      : null;

  const room = findRoomForBooking(
    {
      cottage: String(booking.cottage || ""),
      roomId: booking.roomId as string | number | null,
      assignmentState: booking.assignmentState === "holding" ? "holding" : "assigned",
    },
    rooms as Array<{ id: number | string; name?: string; short?: string }>
  ) as
    | {
        id?: number | string;
        priceWeekday?: number;
        priceWeekend?: number;
        priceOneNightWeekday?: number | null;
        priceOneNightWeekend?: number | null;
        weekendDays?: number[] | null;
      }
    | null;

  const checkIn = parseSafeDate(String(booking.checkIn || ""));
  const nights = nightsBetween(booking);
  const nightlyBasePrices =
    room && !Number.isNaN(checkIn.getTime())
      ? buildStayNightlyBasePrices({
          checkIn,
          nights,
          priceWeekday: Number(room.priceWeekday) || 0,
          priceWeekend: Number(room.priceWeekend) || 0,
          priceOneNightWeekday: room.priceOneNightWeekday,
          priceOneNightWeekend: room.priceOneNightWeekend,
          weekendDays: room.weekendDays,
          roomId: room.id,
          customPrices,
        })
      : undefined;

  const nightlySum = (nightlyBasePrices || []).reduce((s, n) => s + n, 0);
  return resolvePayablePrepayAmount(booking, branding, {
    nightlyBasePrices,
    basePriceTotal: nightlySum > 0 ? nightlySum : undefined,
  });
}
