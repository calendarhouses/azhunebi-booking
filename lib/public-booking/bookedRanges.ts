import { parseSafeDate } from "@/components/admin/desktop/adminDates";
import { bookingHasEarlyLate, findRoomForBooking } from "@/components/admin/desktop/bookingUtils";
import type { BookingRecord, RoomConfig } from "@/components/admin/desktop/types";
import type { BookedRange } from "./types";

export function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function bookingMatchesCottage(
  booking: BookingRecord,
  room: RoomConfig
): boolean {
  return findRoomForBooking(booking, [room])?.id === room.id;
}

export function getBookedRanges(
  bookings: BookingRecord[],
  room: RoomConfig | undefined
): BookedRange[] {
  if (!room) return [];
  return bookings
    .filter((b) => {
      if (b.assignmentState === "holding") return false;
      if (!bookingMatchesCottage(b, room)) return false;
      return !String(b.status).toLowerCase().includes("скас");
    })
    .map((b) => {
      const s = parseSafeDate(b.checkIn);
      s.setHours(0, 0, 0, 0);
      const e = parseSafeDate(b.checkOut);
      e.setHours(0, 0, 0, 0);
      const { hasEarly, hasLate: hasLateComment } = bookingHasEarlyLate(
        String(b.comment || "")
      );
      return { start: s, end: e, hasEarly, hasLate: hasLateComment };
    });
}

export function getNextFreeDateLabel(
  bookings: BookingRecord[],
  room: RoomConfig | undefined
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ranges = getBookedRanges(bookings, room);
  const d = new Date(today);
  for (let i = 0; i < 365; i++) {
    const occupied = ranges.some((r) => d >= r.start && d < r.end);
    if (!occupied) {
      return d.toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
    }
    d.setDate(d.getDate() + 1);
  }
  return "Немає";
}
