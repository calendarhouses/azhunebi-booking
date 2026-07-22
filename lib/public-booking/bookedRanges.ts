import { parseSafeDate } from "@/components/admin/desktop/adminDates";
import {
  getBookingMinNightsRequired,
  hasClosedDateInStay,
} from "@/components/admin/desktop/bookingPriceEngine";
import { bookingHasEarlyLate, findRoomForBooking } from "@/components/admin/desktop/bookingUtils";
import { roomFitsChildrenPolicy } from "@/components/admin/desktop/settings/additionalServicesLogic";
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
  children: number,
  youngestAge?: number | null
): boolean {
  if (!roomFitsChildrenPolicy(room, children, youngestAge ?? null)) return false;
  const max = room.maxCapacity || room.capacity || 0;
  return adults + children <= max;
}

function isRoomNightOccupied(day: Date, ranges: BookedRange[]): boolean {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  return ranges.some((r) => d >= r.start && d < r.end);
}

/**
 * Search calendar: a check-in day is selectable if at least one room has that night free
 * (and fits guest party / is not closed).
 */
export function isListSearchCheckInFree(
  day: Date,
  rooms: RoomConfig[],
  opts: {
    adults: number;
    children: number;
    youngestAge?: number | null;
    bookings: BookingRecord[];
    closedDates?: AdminSettingsPayload["closedDates"];
    restrictions?: AdminSettingsPayload["restrictions"];
  }
): boolean {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  const partyActive = opts.children > 0;
  for (const room of rooms) {
    if (partyActive && !roomFitsGuestParty(room, opts.adults, opts.children, opts.youngestAge)) {
      continue;
    }
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    if (hasClosedDateInStay(opts.closedDates, room, d, next, opts.restrictions)) continue;
    const ranges = getBookedRanges(opts.bookings, room);
    if (!isRoomNightOccupied(d, ranges)) return true;
  }
  return false;
}

/**
 * Search calendar: checkout day is selectable if at least one room is free for [checkIn, checkOut).
 */
export function isListSearchCheckOutFree(
  checkIn: Date,
  checkOut: Date,
  rooms: RoomConfig[],
  opts: {
    adults: number;
    children: number;
    youngestAge?: number | null;
    bookings: BookingRecord[];
    closedDates?: AdminSettingsPayload["closedDates"];
    restrictions?: AdminSettingsPayload["restrictions"];
  }
): boolean {
  const start = new Date(checkIn);
  start.setHours(0, 0, 0, 0);
  const end = new Date(checkOut);
  end.setHours(0, 0, 0, 0);
  if (!(end > start)) return false;

  const partyActive = opts.children > 0;
  for (const room of rooms) {
    if (partyActive && !roomFitsGuestParty(room, opts.adults, opts.children, opts.youngestAge)) {
      continue;
    }
    if (
      isRoomFreeForRange(
        room,
        start,
        end,
        opts.bookings,
        opts.closedDates,
        opts.restrictions
      )
    ) {
      return true;
    }
  }
  return false;
}

/** Unified day availability for list search calendar (check-in or check-out phase). */
export function isListSearchDateAvailable(
  day: Date,
  rooms: RoomConfig[],
  opts: {
    checkIn: Date | null;
    checkOut: Date | null;
    adults: number;
    children: number;
    youngestAge?: number | null;
    bookings: BookingRecord[];
    closedDates?: AdminSettingsPayload["closedDates"];
    restrictions?: AdminSettingsPayload["restrictions"];
  }
): boolean {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) return false;

  const pickingCheckOut = Boolean(opts.checkIn && !opts.checkOut && d > opts.checkIn);
  if (pickingCheckOut && opts.checkIn) {
    return isListSearchCheckOutFree(opts.checkIn, d, rooms, opts);
  }
  return isListSearchCheckInFree(d, rooms, opts);
}

export function filterRoomsForStay(
  rooms: RoomConfig[],
  opts: {
    checkIn: Date | null;
    checkOut: Date | null;
    adults: number;
    children: number;
    youngestAge?: number | null;
    bookings: BookingRecord[];
    closedDates?: AdminSettingsPayload["closedDates"];
    restrictions?: AdminSettingsPayload["restrictions"];
  }
): RoomConfig[] {
  const {
    checkIn,
    checkOut,
    adults,
    children,
    youngestAge = null,
    bookings,
    closedDates,
    restrictions,
  } = opts;
  const datesActive = Boolean(checkIn && checkOut);
  const partyActive = datesActive || children > 0;

  return rooms.filter((room) => {
    if (partyActive) {
      if (!roomFitsGuestParty(room, adults, children, youngestAge)) return false;
    }
    if (datesActive) {
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
