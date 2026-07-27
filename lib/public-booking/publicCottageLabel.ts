import { findRoomForBooking, type RoomLike } from "@/lib/admin/roomBookingMatch";

/**
 * Guest-facing house name.
 *
 * Bookings store the chessboard label («Будиночок 7») because the whole admin
 * side and all staff notifications key off it. Guests, however, browse the
 * public listing name («Будиночок 1-12»), so anything they see after booking
 * must be mapped back to that name.
 */
export function publicCottageLabel(
  booking: { cottage?: string; roomId?: string | number | null },
  rooms: RoomLike[] | null | undefined,
  fallback = "Котедж"
): string {
  const room = Array.isArray(rooms) ? findRoomForBooking(booking, rooms) : null;
  return room?.name?.trim() || String(booking.cottage || "").trim() || fallback;
}
