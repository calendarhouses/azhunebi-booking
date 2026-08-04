import { computeBookingPrice } from "@/components/admin/desktop/bookingPriceEngine";
import { parseBookingComment } from "@/components/admin/desktop/bookingUtils";
import type {
  AdminSettingsPayload,
  BookingRecord,
  RoomConfig,
} from "@/components/admin/desktop/types";
import { listActiveSpecialTariffDiscounts } from "@/lib/admin/specialTariffBooking";
import { listBookings } from "@/lib/db/bookings";
import type { ApiBooking } from "@/lib/db/mappers";
import { getSettingsPayload } from "@/lib/db/settings";
import {
  calculatePrepaymentAmount,
  readPrepaymentPolicy,
} from "@/lib/public-booking/prepaymentPolicy";
import { parsePostLateArrivalFromComment } from "@/lib/public-booking/postLateGapStay";
import type { PublicBranding } from "@/lib/public-booking/types";

export type PublicRepriceResult =
  | {
      ok: true;
      totalPrice: number;
      prepayAmount: number;
      basePrice: number;
      extraGuestFee: number;
      petFee: number;
      dayGuestFee: number;
      earlyFee: number;
      lateFee: number;
      nights: number;
    }
  | {
      ok: false;
      error: "OVERLAP" | "MIN_STAY" | "NO_ROOM" | "INVALID_DATES" | "PRICE_FAILED";
      message: string;
      requiredMin?: number;
    };

function asRoomList(settings: AdminSettingsPayload): RoomConfig[] {
  return Array.isArray(settings.roomsList) ? settings.roomsList : [];
}

function resolveRoom(
  settings: AdminSettingsPayload,
  payload: Record<string, unknown>
): RoomConfig | undefined {
  const rooms = asRoomList(settings);
  const roomId = payload.roomId != null ? String(payload.roomId) : "";
  if (roomId) {
    const byId = rooms.find((r) => String(r.id) === roomId);
    if (byId) return byId;
  }
  const cottage = String(payload.cottage || "").trim().toLowerCase();
  if (!cottage) return undefined;
  return rooms.find((r) => {
    const name = String(r.name || "").trim().toLowerCase();
    const short = String(r.short || "").trim().toLowerCase();
    return name === cottage || short === cottage;
  });
}

/**
 * Recompute public-site booking totals from trusted settings + comment tokens.
 * Overwrites client-supplied totalPrice / prepayAmount.
 */
export async function repricePublicBooking(
  payload: Record<string, unknown>
): Promise<PublicRepriceResult> {
  const checkIn = String(payload.checkIn || "").slice(0, 10);
  const checkOut = String(payload.checkOut || "").slice(0, 10);
  if (!checkIn || !checkOut) {
    return { ok: false, error: "INVALID_DATES", message: "checkIn/checkOut required" };
  }

  const settings = (await getSettingsPayload({
    omitSms: true,
    omitTransactions: true,
    omitTeam: true,
  })) as AdminSettingsPayload;

  const room = resolveRoom(settings, payload);
  if (!room) {
    return { ok: false, error: "NO_ROOM", message: "Room not found" };
  }

  const toggles = listActiveSpecialTariffDiscounts(
    Array.isArray(settings.discountsList) ? settings.discountsList : []
  );
  const comment = String(payload.comment || "");
  const parsed = parseBookingComment(comment, toggles);
  const postLate = parsePostLateArrivalFromComment(comment);
  const enabledSpecialTariffIds = Object.entries(parsed.specialTariffs)
    .filter(([, v]) => v === "Так")
    .map(([id]) => id);

  const allBookings = (await listBookings()) as BookingRecord[];
  const guests = Math.max(1, Math.round(Number(payload.guests) || 1));

  const calc = computeBookingPrice({
    checkInStr: checkIn,
    checkOutStr: checkOut,
    roomName: String(room.name || payload.cottage || ""),
    guests,
    children: parsed.children,
    pets: String(payload.pets || "Ні"),
    dayGuests: parsed.dayGuests,
    isVat: parsed.vat === "Так",
    selectedServices: parsed.selectedServices,
    isPublicBooking: true,
    promoCode: parsed.promoCode,
    enabledSpecialTariffIds,
    selectedEarlyTime: postLate ? null : parsed.earlyTime,
    selectedLateTime: parsed.lateTime,
    selectedPostLateArrivalTime: postLate,
    room,
    settings,
    allBookings,
    editingRow: null,
    isInitialLoad: false,
    manual: {
      base: null,
      extra: null,
      pet: null,
      dayGuest: null,
      early: null,
      late: null,
      discount: null,
      discountEdited: false,
    },
    prevForm: null,
  });

  if (calc.isOverlap) {
    return {
      ok: false,
      error: "OVERLAP",
      message: calc.overlapReason || "Дати зайняті",
    };
  }
  if (calc.restrViolation) {
    return {
      ok: false,
      error: "MIN_STAY",
      message: `Мінімум ${calc.requiredMinNights} ночей`,
      requiredMin: calc.requiredMinNights,
    };
  }
  if (calc.empty || calc.totalPrice < 0) {
    return { ok: false, error: "PRICE_FAILED", message: "Could not compute price" };
  }

  const branding = (settings.branding || {}) as PublicBranding;
  const prepayAmount = calculatePrepaymentAmount(readPrepaymentPolicy(branding), {
    totalPrice: calc.totalPrice,
    basePriceTotal: calc.basePriceTotal,
    nights: calc.nights,
    nightlyBasePrices: calc.nightlyBasePrices,
  });

  return {
    ok: true,
    totalPrice: Math.round(calc.totalPrice),
    prepayAmount: Math.round(prepayAmount),
    basePrice: Math.round(calc.basePriceTotal),
    extraGuestFee: Math.round(calc.extraGuestFee),
    petFee: Math.round(calc.petFee),
    dayGuestFee: Math.round(calc.dayGuestFee),
    earlyFee: Math.round(calc.earlyFee),
    lateFee: Math.round(calc.lateFee),
    nights: calc.nights,
  };
}

/** Apply repriced money fields onto a booking draft (mutates-friendly copy). */
export function applyPublicReprice(
  booking: ApiBooking,
  priced: Extract<PublicRepriceResult, { ok: true }>
): ApiBooking {
  return {
    ...booking,
    totalPrice: priced.totalPrice,
    prepayAmount: priced.prepayAmount,
    basePrice: priced.basePrice,
    extraGuestFee: priced.extraGuestFee,
    petFee: priced.petFee,
    dayGuestFee: priced.dayGuestFee,
    earlyFee: priced.earlyFee,
    lateFee: priced.lateFee,
    paidAmount: 0,
  };
}
