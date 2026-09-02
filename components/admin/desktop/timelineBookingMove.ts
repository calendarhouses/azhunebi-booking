import { parseSafeDate } from "./adminDates";
import { formatDateKey, findRoomForBooking } from "./bookingUtils";
import { adminRoomCottageValue } from "@/lib/admin/roomDisplay";
import type { BookingRecord, RoomConfig } from "./types";

export const TIMELINE_ROW_HEIGHT = 70;
export const TIMELINE_ROW_HEIGHT_COMPACT = 48;

export function getTimelineRowHeight(focusLayout: boolean): number {
  return focusLayout ? TIMELINE_ROW_HEIGHT_COMPACT : TIMELINE_ROW_HEIGHT;
}
export const BOOKING_MOVE_THRESHOLD = 5;
export const HOLDING_ROOM_ID = -999999;
export const HOLDING_ROOM: RoomConfig = {
  id: HOLDING_ROOM_ID,
  name: "Нерозподілені",
  short: "Нерозподілені",
  desc: "Без призначеного будинку",
  active: true,
  capacity: 99,
  maxCapacity: 99,
  priceWeekday: 0,
  priceWeekend: 0,
};

export function isHoldingRoom(room: RoomConfig): boolean {
  return room.id === HOLDING_ROOM_ID;
}

/** Стабільний ключ рядка шахматки (id), не публічна назва. */
export function timelineRoomKey(room: Pick<RoomConfig, "id">): string {
  return String(room.id);
}

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
  pointerType: string;
  /** Touch.identifier when known — required for Android cancel/end matching. */
  touchId: number | null;
  /** Touch: drag only after long-press tooltip. Mouse: armed immediately. */
  dragArmed: boolean;
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
  if (booking.assignmentState === "holding") {
    return activeRooms.findIndex(isHoldingRoom);
  }
  const room = findRoomForBooking(booking, activeRooms);
  if (!room) return activeRooms.findIndex(isHoldingRoom);
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
  const { createdAt: _ignoredCreatedAt, accessToken: _ignoredToken, ...rest } =
    booking as BookingRecord & { accessToken?: unknown };
  return {
    ...rest,
    checkIn,
    checkOut,
    cottage: isHoldingRoom(room) ? "" : adminRoomCottageValue(room),
    roomId: isHoldingRoom(room) ? "" : room.id,
    assignmentState: isHoldingRoom(room) ? "holding" : "assigned",
    row: booking.row,
    id: booking.id != null && String(booking.id).trim() !== "" ? String(booking.id).trim() : booking.id,
    name: booking.name,
    // Never reuse a stale body token from a booking blob — auth goes via Bearer.
    accessToken: undefined,
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
    cottage: isHoldingRoom(room) ? "" : adminRoomCottageValue(room),
    roomId: isHoldingRoom(room) ? "" : room.id,
    assignmentState: isHoldingRoom(room) ? "holding" : "assigned",
  };
}
