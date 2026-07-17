import { computeBookingPrice } from "./bookingPriceEngine";
import { parseBookingComment } from "./bookingUtils";
import type { AdminSettingsPayload, BookingRecord, RoomConfig } from "./types";

export function quoteMovedBooking(
  booking: BookingRecord,
  room: RoomConfig,
  checkIn: string,
  checkOut: string,
  settings: AdminSettingsPayload,
  allBookings: BookingRecord[]
) {
  const parsed = parseBookingComment(String(booking.comment || ""));
  const result = computeBookingPrice({
    checkInStr: checkIn,
    checkOutStr: checkOut,
    roomName: room.name,
    guests: Number(booking.guests) || 2,
    children: parsed.children,
    pets: booking.pets === true ? "Так" : String(booking.pets || "Ні"),
    dayGuests: parsed.dayGuests,
    isVat: parsed.vat === "Так",
    selectedServices: parsed.selectedServices,
    promoCode: parsed.promoCode,
    enabledSpecialTariffIds: Object.entries(parsed.specialTariffs)
      .filter(([, enabled]) => enabled === "Так")
      .map(([id]) => id),
    selectedEarlyTime: parsed.earlyTime,
    selectedLateTime: parsed.lateTime,
    room,
    settings,
    allBookings,
    editingRow: booking.row,
    editingId: booking.id,
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
    savedBooking: booking,
  });
  if (result.empty || result.isOverlap) return null;
  return {
    oldTotal: Math.round(Number(booking.totalPrice) || 0),
    newTotal: Math.round(result.totalPrice),
    overrides: {
      totalPrice: Math.round(result.totalPrice),
      basePrice: Math.round(result.basePriceTotal),
      extraGuestFee: Math.round(result.extraGuestFee),
      petFee: Math.round(result.petFee),
      dayGuestFee: Math.round(result.dayGuestFee),
      earlyFee: Math.round(result.earlyFee),
      lateFee: Math.round(result.lateFee),
    } satisfies Partial<BookingRecord>,
  };
}
