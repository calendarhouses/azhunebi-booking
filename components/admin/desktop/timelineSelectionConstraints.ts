import { normalizeDateToIso, parseSafeDate } from "./adminDates";
import { bookingHasEarlyLate, findRoomForBooking } from "./bookingUtils";
import { shiftDateKey } from "./timelineBookingMove";
import type { BookingRecord, RoomConfig } from "./types";

export type OccupiedInterval = {
  checkIn: string;
  checkOut: string;
};

export type RoomTimelineConstraints = {
  /** День, у який не можна почати заїзд (після пізнього виїзду попередньої броні). */
  blockedCheckInDays: Set<string>;
  /** День, у який не можна оформити виїзд (перед раннім заїздом наступної броні). */
  blockedCheckOutDays: Set<string>;
  /** Існуючі броні в рядку (checkIn включно, checkOut виключно). */
  occupied: OccupiedInterval[];
};

function toDateKey(value: unknown): string {
  return normalizeDateToIso(String(value || ""));
}

function isCancelled(booking: BookingRecord): boolean {
  return String(booking.status || "").toLowerCase().includes("скас");
}

function shouldExcludeBooking(
  booking: BookingRecord,
  excludeBookingKey?: string | number | null
): boolean {
  if (!excludeBookingKey) return false;
  const key = String(excludeBookingKey).trim();
  return String(booking.id) === key || String(booking.row) === key;
}

export function rangesOverlap(
  checkInA: string,
  checkOutA: string,
  checkInB: string,
  checkOutB: string
): boolean {
  return checkInA < checkOutB && checkOutA > checkInB;
}

function selectionCheckOut(rangeEnd: string): string {
  return shiftDateKey(rangeEnd, 1);
}

function snapStartAwayFromOccupied(
  start: string,
  constraints: RoomTimelineConstraints
): string {
  let result = start;
  for (const occ of constraints.occupied) {
    if (result >= occ.checkIn && result < occ.checkOut) {
      result = occ.checkOut;
    }
  }
  return result;
}

function clampEndBeforeOccupied(
  start: string,
  end: string,
  constraints: RoomTimelineConstraints
): string {
  let result = end;
  for (const occ of constraints.occupied) {
    if (!rangesOverlap(start, selectionCheckOut(result), occ.checkIn, occ.checkOut)) {
      continue;
    }
    if (occ.checkIn > start) {
      const maxEnd = shiftDateKey(occ.checkIn, -1);
      if (maxEnd < start) {
        result = start;
      } else if (result > maxEnd) {
        result = maxEnd;
      }
    } else if (start >= occ.checkIn && start < occ.checkOut) {
      result = start;
    }
  }
  return result;
}

function clampStartBeforeOccupied(
  start: string,
  end: string,
  constraints: RoomTimelineConstraints
): string {
  let result = start;
  for (const occ of constraints.occupied) {
    if (!rangesOverlap(result, selectionCheckOut(end), occ.checkIn, occ.checkOut)) {
      continue;
    }
    if (result < occ.checkOut && selectionCheckOut(end) > occ.checkIn) {
      if (result >= occ.checkIn && result < occ.checkOut) {
        result = occ.checkOut;
      } else if (end >= occ.checkIn) {
        result = occ.checkOut;
      }
    }
  }
  return result;
}

export function buildRoomTimelineConstraints(
  roomBookings: BookingRecord[],
  excludeBookingKey?: string | number | null
): RoomTimelineConstraints {
  const blockedCheckInDays = new Set<string>();
  const blockedCheckOutDays = new Set<string>();
  const occupied: OccupiedInterval[] = [];

  for (const booking of roomBookings) {
    if (shouldExcludeBooking(booking, excludeBookingKey)) continue;
    if (isCancelled(booking)) continue;

    const checkIn = toDateKey(booking.checkIn);
    const checkOut = toDateKey(booking.checkOut);
    if (!checkIn || !checkOut || checkIn >= checkOut) continue;

    occupied.push({ checkIn, checkOut });

    const { hasEarly, hasLate } = bookingHasEarlyLate(String(booking.comment || ""));
    if (hasLate) {
      blockedCheckInDays.add(checkOut);
      blockedCheckOutDays.add(checkOut);
    }
    if (hasEarly) {
      blockedCheckOutDays.add(checkIn);
      blockedCheckInDays.add(checkIn);
    }
  }

  return { blockedCheckInDays, blockedCheckOutDays, occupied };
}

/** @deprecated alias */
export const buildRoomEarlyLateConstraints = buildRoomTimelineConstraints;

export function buildTimelineConstraintsByRoom(
  bookings: BookingRecord[],
  activeRooms: RoomConfig[],
  excludeBookingKey?: string | number | null
): Map<string, RoomTimelineConstraints> {
  const byRoomId = new Map<number, BookingRecord[]>();
  for (const room of activeRooms) {
    byRoomId.set(Number(room.id), []);
  }
  for (const booking of bookings) {
    const room = findRoomForBooking(booking, activeRooms);
    if (!room) continue;
    byRoomId.get(Number(room.id))?.push(booking);
  }

  const map = new Map<string, RoomTimelineConstraints>();
  for (const room of activeRooms) {
    map.set(
      String(room.id),
      buildRoomTimelineConstraints(
        byRoomId.get(Number(room.id)) || [],
        excludeBookingKey
      )
    );
  }
  return map;
}

/** @deprecated alias */
export const buildEarlyLateConstraintsByRoom = buildTimelineConstraintsByRoom;

export type EarlyLateConstraints = Pick<
  RoomTimelineConstraints,
  "blockedCheckInDays" | "blockedCheckOutDays"
>;

export function isSelectionRangeAvailable(
  rangeStart: string,
  rangeEnd: string,
  constraints: RoomTimelineConstraints
): boolean {
  const start = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
  const end = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
  const checkOut = selectionCheckOut(end);

  if (start >= checkOut) return false;
  if (constraints.blockedCheckInDays.has(start)) return false;
  if (constraints.blockedCheckOutDays.has(checkOut)) return false;

  for (const occ of constraints.occupied) {
    if (rangesOverlap(start, checkOut, occ.checkIn, occ.checkOut)) {
      return false;
    }
  }

  return true;
}

/** @deprecated alias */
export const isSelectionRangeValid = isSelectionRangeAvailable;

export function resolveSelectionStartFromPointer(
  cellDate: string,
  clientX: number,
  cellRect: Pick<DOMRect, "left" | "width">,
  constraints: RoomTimelineConstraints | undefined
): string {
  const isRightHalf = clientX - cellRect.left >= cellRect.width / 2;
  if (constraints) {
    const preview = resolveHoverPreviewRange(cellDate, isRightHalf, constraints);
    if (preview) return preview.checkIn;
  }
  const rawStart = isRightHalf ? cellDate : shiftDateKey(cellDate, -1);
  return snapSelectionStart(rawStart, constraints);
}

export function snapSelectionStart(
  date: string,
  constraints: RoomTimelineConstraints | undefined
): string {
  if (!constraints) return date;
  let start = date;
  if (constraints.blockedCheckInDays.has(start)) {
    start = shiftDateKey(start, 1);
  }
  start = snapStartAwayFromOccupied(start, constraints);
  if (constraints.blockedCheckInDays.has(start)) {
    start = shiftDateKey(start, 1);
  }
  return start;
}

export function resolveSelectionNightFromPointer(
  cellDate: string,
  clientX: number,
  cellRect: Pick<DOMRect, "left" | "width">
): string {
  const isRightHalf = clientX - cellRect.left >= cellRect.width / 2;
  return isRightHalf ? cellDate : shiftDateKey(cellDate, -1);
}

/** Надійніший hit-test по X (без elementFromPoint — ламається на Android).
 *  `days` may be a virtual window slice — pass `virtualStartIndex` so X maps to absolute days. */
export function resolveTimelineCellFromClientX(
  trackEl: HTMLElement,
  clientX: number,
  cellWidth: number,
  days: { dateString: string }[],
  virtualStartIndex = 0
): { date: string; cellRect: Pick<DOMRect, "left" | "width"> } | null {
  if (cellWidth <= 0 || days.length === 0) return null;
  const rect = trackEl.getBoundingClientRect();
  const x = clientX - rect.left;
  if (x < 0) return null;
  const absoluteIndex = Math.floor(x / cellWidth);
  const localIndex = Math.max(
    0,
    Math.min(days.length - 1, absoluteIndex - virtualStartIndex)
  );
  const cellAbsoluteIndex = virtualStartIndex + localIndex;
  const cellLeft = rect.left + cellAbsoluteIndex * cellWidth;
  return {
    date: days[localIndex].dateString,
    cellRect: { left: cellLeft, width: cellWidth },
  };
}

export function clampSelectionWithAnchor(
  anchor: string,
  moving: string,
  constraints: RoomTimelineConstraints
): { start: string; end: string } {
  let start = anchor <= moving ? anchor : moving;
  let end = anchor <= moving ? moving : anchor;

  start = snapStartAwayFromOccupied(start, constraints);
  if (constraints.blockedCheckInDays.has(start)) {
    start = shiftDateKey(start, 1);
    if (start > end) end = start;
  }

  end = clampEndBeforeOccupied(start, end, constraints);
  start = clampStartBeforeOccupied(start, end, constraints);

  while (end >= start && constraints.blockedCheckOutDays.has(selectionCheckOut(end))) {
    end = shiftDateKey(end, -1);
  }

  if (end < start) {
    end = start;
  }

  if (constraints.blockedCheckInDays.has(start)) {
    start = shiftDateKey(start, 1);
    if (end < start) end = start;
  }

  end = clampEndBeforeOccupied(start, end, constraints);

  if (!isSelectionRangeAvailable(start, end, constraints)) {
    return { start: anchor, end: anchor };
  }

  return { start, end };
}

export function resolveHoverPreviewRange(
  date: string,
  isRightHalf: boolean,
  constraints: RoomTimelineConstraints
): { checkIn: string; checkOut: string } | null {
  let checkIn = isRightHalf ? date : shiftDateKey(date, -1);
  let checkOut = isRightHalf ? shiftDateKey(date, 1) : date;

  if (constraints.blockedCheckInDays.has(checkIn)) {
    if (!isRightHalf) return null;
    checkIn = shiftDateKey(date, 1);
    checkOut = shiftDateKey(date, 2);
  }

  if (constraints.blockedCheckOutDays.has(checkOut)) {
    if (isRightHalf) return null;
    checkOut = shiftDateKey(date, -1);
    checkIn = shiftDateKey(date, -2);
  }

  checkIn = snapStartAwayFromOccupied(checkIn, constraints);
  if (constraints.blockedCheckInDays.has(checkIn)) {
    return null;
  }

  if (checkIn >= checkOut) return null;
  if (!isSelectionRangeAvailable(checkIn, checkIn, constraints)) return null;

  return { checkIn, checkOut };
}

function countNightsBetween(checkIn: string, checkOut: string): number {
  const d1 = parseSafeDate(checkIn);
  const d2 = parseSafeDate(checkOut);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

export function snapMovedBookingDates(
  checkIn: string,
  checkOut: string,
  constraints: RoomTimelineConstraints
): { checkIn: string; checkOut: string } | null {
  let ci = checkIn;
  let co = checkOut;
  if (ci >= co) return null;

  const nights = countNightsBetween(ci, co);
  if (nights <= 0) return null;

  for (let i = 0; i < 400; i++) {
    const lastNight = shiftDateKey(co, -1);
    if (isSelectionRangeAvailable(ci, lastNight, constraints)) {
      return { checkIn: ci, checkOut: co };
    }

    if (constraints.blockedCheckInDays.has(ci)) {
      ci = shiftDateKey(ci, 1);
      co = shiftDateKey(co, 1);
      continue;
    }

    if (constraints.blockedCheckOutDays.has(co)) {
      co = shiftDateKey(co, -1);
      ci = shiftDateKey(ci, -1);
      continue;
    }

    const conflict = constraints.occupied.find((occ) =>
      rangesOverlap(ci, co, occ.checkIn, occ.checkOut)
    );
    if (!conflict) return null;

    const afterCheckIn = conflict.checkOut;
    const afterCheckOut = shiftDateKey(afterCheckIn, nights);
    if (
      afterCheckIn < afterCheckOut &&
      isSelectionRangeAvailable(afterCheckIn, shiftDateKey(afterCheckOut, -1), constraints)
    ) {
      return { checkIn: afterCheckIn, checkOut: afterCheckOut };
    }

    const beforeCheckOut = conflict.checkIn;
    const beforeCheckIn = shiftDateKey(beforeCheckOut, -nights);
    if (
      beforeCheckIn < beforeCheckOut &&
      isSelectionRangeAvailable(beforeCheckIn, shiftDateKey(beforeCheckOut, -1), constraints)
    ) {
      return { checkIn: beforeCheckIn, checkOut: beforeCheckOut };
    }

    return null;
  }

  return null;
}
