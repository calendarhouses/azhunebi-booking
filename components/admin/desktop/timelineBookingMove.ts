import { parseSafeDate } from "./adminDates";
import { formatDateKey, findRoomForBooking } from "./bookingUtils";
import type { BookingRecord, RoomConfig } from "./types";

export const TIMELINE_ROW_HEIGHT = 70;
export const TIMELINE_ROW_HEIGHT_COMPACT = 48;

export function getTimelineRowHeight(focusLayout: boolean): number {
  return focusLayout ? TIMELINE_ROW_HEIGHT_COMPACT : TIMELINE_ROW_HEIGHT;
}
export const BOOKING_MOVE_THRESHOLD = 5;

export type BookingMoveSession = {
  booking: BookingRecord;
  blockLeft: number;
  blockWidth: number;
  gridRowIndex: number;
  activeRoomIndex: number;
  startX: number;
  startY: number;
  startXInGrid: number;
  deltaDays: number;
  targetRoomIndex: number;
  moved: boolean;
  pointerId: number;
  previewActive?: boolean;
};

export function bookingMoveKey(booking: BookingRecord): string | number {
  return booking.id || booking.row;
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const d = parseSafeDate(dateKey);
  d.setDate(d.getDate() + deltaDays);
  return formatDateKey(d);
}

export function resolveActiveRoomIndex(booking: BookingRecord, activeRooms: RoomConfig[]): number {
  const room = findRoomForBooking(booking, activeRooms);
  if (!room) return -1;
  return activeRooms.findIndex((r) => r.id === room.id);
}

export function resolveTargetRoomIndex(
  clientY: number,
  gridTop: number,
  roomCount: number,
  rowHeight: number = TIMELINE_ROW_HEIGHT
): number {
  if (roomCount <= 0) return 0;
  const idx = Math.floor((clientY - gridTop) / rowHeight);
  return Math.max(0, Math.min(roomCount - 1, idx));
}

export function buildBookingMovePayload(
  booking: BookingRecord,
  room: RoomConfig,
  checkIn: string,
  checkOut: string
): Record<string, unknown> {
  return {
    ...booking,
    checkIn,
    checkOut,
    cottage: room.name,
    roomId: room.id,
    row: booking.row,
    id: booking.id != null && String(booking.id).trim() !== "" ? String(booking.id).trim() : booking.id,
    name: booking.name,
  };
}

export function applyBookingMove(
  booking: BookingRecord,
  room: RoomConfig,
  checkIn: string,
  checkOut: string
): BookingRecord {
  return {
    ...booking,
    checkIn,
    checkOut,
    cottage: room.name,
    roomId: room.id,
  };
}
