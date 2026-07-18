import { parseSafeDate } from "@/components/admin/desktop/adminDates";
import {
  getBookingMinNightsRequired,
  hasClosedDateInStay,
} from "@/components/admin/desktop/bookingPriceEngine";
import { bookingHasEarlyLate, findRoomForBooking } from "@/components/admin/desktop/bookingUtils";
import { roomAllowsChildren } from "@/components/admin/desktop/settings/additionalServicesLogic";
import type {
  AdminSettingsPayload,
  BookingRecord,
  RoomConfig,
} from "@/components/admin/desktop/types";
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

function stayConflictsWithRange(
  checkIn: Date,
  checkOut: Date,
  range: BookedRange
): boolean {
  const cur = new Date(checkIn);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(checkOut);
  end.setHours(0, 0, 0, 0);
  while (cur < end) {
    if (cur > range.start && cur < range.end) return true;
    if (cur.getTime() === range.start.getTime() && range.hasEarly) return true;
    if (cur.getTime() === range.end.getTime() && range.hasLate) return true;
    cur.setDate(cur.getDate() + 1);
  }
  return false;
}

/** Чи вільний котедж на період [checkIn, checkOut) з урахуванням closed/min nights. */
export function isRoomFreeForRange(
  room: RoomConfig,
  checkIn: Date,
  checkOut: Date,
  bookings: BookingRecord[],
  closedDates?: AdminSettingsPayload["closedDates"],
  restrictions?: AdminSettingsPayload["restrictions"]
): boolean {
  const start = new Date(checkIn);
  start.setHours(0, 0, 0, 0);
  const end = new Date(checkOut);
  end.setHours(0, 0, 0, 0);
  if (!(end > start)) return false;

  if (hasClosedDateInStay(closedDates, room, start, end, restrictions)) {
    return false;
  }

  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);
  const req = getBookingMinNightsRequired(room, start, end, restrictions || {});
  if (req > 0 && nights < req) return false;

  const ranges = getBookedRanges(bookings, room);
  for (const range of ranges) {
    if (stayConflictsWithRange(start, end, range)) return false;
  }
  return true;
}

export function roomFitsGuestParty(
  room: RoomConfig,
  adults: number,
  children: number
): boolean {
  if (children > 0 && !roomAllowsChildren(room)) return false;
  const max = room.maxCapacity || room.capacity || 0;
  return adults + children <= max;
}

export function filterRoomsForStay(
  rooms: RoomConfig[],
  opts: {
    checkIn: Date | null;
    checkOut: Date | null;
    adults: number;
    children: number;
    bookings: BookingRecord[];
    closedDates?: AdminSettingsPayload["closedDates"];
    restrictions?: AdminSettingsPayload["restrictions"];
  }
): RoomConfig[] {
  const { checkIn, checkOut, adults, children, bookings, closedDates, restrictions } =
    opts;
  const datesActive = Boolean(checkIn && checkOut);

  return rooms.filter((room) => {
    if (datesActive) {
      if (!roomFitsGuestParty(room, adults, children)) return false;
      if (
        !isRoomFreeForRange(
          room,
          checkIn as Date,
          checkOut as Date,
          bookings,
          closedDates,
          restrictions
        )
      ) {
        return false;
      }
    }
    return true;
  });
}
