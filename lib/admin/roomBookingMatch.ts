/** Прив’язка броні до житла: спочатку стабільний roomId, потім назва (legacy). */

export type RoomLike = {
  id: number | string;
  name?: string;
  short?: string;
};

export type BookingLike = {
  cottage?: string;
  roomId?: number | string | null;
};

export function getBookingRoomId(booking: BookingLike): string | null {
  const id = booking.roomId;
  if (id == null || id === "") return null;
  return String(id);
}

export function normalizeRoomLabel(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/№/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function bookingMatchesRoomAliases(cottage: string, room: RoomLike): boolean {
  const cottageStr = String(cottage || "").trim().toUpperCase();
  const lower = cottageStr.toLowerCase();
  const id = Number(room.id);

  if (id === 3 && cottageStr.includes("ЛЮКС")) return true;
  if (id === 2 && cottageStr.includes("СІМЕЙН")) return true;

  if (
    id === 1 &&
    (lower.includes("котедж 1") ||
      lower.includes("номер 1") ||
      lower.includes("junior") ||
      lower.includes("family 1") ||
      lower.includes("family1") ||
      lower.includes("фемілі 1") ||
      lower.includes("фемілі1"))
  ) {
    return true;
  }
  if (
    id === 2 &&
    (lower.includes("котедж 2") ||
      lower.includes("номер 2") ||
      lower.includes("family 2") ||
      lower.includes("family №2") ||
      lower.includes("сімейн"))
  ) {
    return true;
  }
  if (
    id === 3 &&
    (lower.includes("котедж 3") ||
      lower.includes("номер 3") ||
      lower.includes("family 3") ||
      lower.includes("люкс"))
  ) {
    return true;
  }
  if (id === 4 && (lower.includes("котедж 4") || lower.includes("номер 4") || lower.includes("family 4"))) {
    return true;
  }

  return false;
}

function cottageMatchesRoomLabels(cottage: string, room: RoomLike): boolean {
  const normalized = normalizeRoomLabel(cottage);
  if (!normalized) return false;

  const n = normalizeRoomLabel(room.name || "");
  const s = normalizeRoomLabel(room.short || "");
  for (const key of [n, s]) {
    if (!key) continue;
    const hasDigits = /\d/.test(normalized) || /\d/.test(key);
    const softMatch = !hasDigits && (normalized.includes(key) || key.includes(normalized));
    if (normalized === key || softMatch) return true;
  }
  return bookingMatchesRoomAliases(cottage, room);
}

/** Знайти житло для броні (roomId має пріоритет над текстовою назвою). */
export function findRoomForBooking(booking: BookingLike, rooms: RoomLike[]): RoomLike | null {
  const bookingRoomId = getBookingRoomId(booking);
  if (bookingRoomId) {
    const byId = rooms.find((r) => String(r.id) === bookingRoomId);
    if (byId) return byId;
  }

  const cottage = String(booking.cottage || "").trim();
  if (!cottage) return null;

  for (const room of rooms) {
    if (cottageMatchesRoomLabels(cottage, room)) return room;
  }

  return null;
}

export function bookingBelongsToRoom(booking: BookingLike, room: RoomLike): boolean {
  const bookingRoomId = getBookingRoomId(booking);
  if (bookingRoomId && String(room.id) === bookingRoomId) return true;
  return cottageMatchesRoomLabels(String(booking.cottage || ""), room);
}

export function resolveRoomIdForCottage(
  cottage: string,
  rooms: RoomLike[],
  explicitRoomId?: number | string | null
): number | string | null {
  if (explicitRoomId != null && explicitRoomId !== "") {
    const id = String(explicitRoomId);
    if (rooms.some((r) => String(r.id) === id)) return explicitRoomId;
  }
  return findRoomForBooking({ cottage, roomId: explicitRoomId ?? null }, rooms)?.id ?? null;
}

export function bookingsShareSameRoom(
  a: BookingLike,
  b: BookingLike,
  rooms: RoomLike[]
): boolean {
  const roomA = findRoomForBooking(a, rooms);
  const roomB = findRoomForBooking(b, rooms);
  if (!roomA || !roomB) return false;
  return String(roomA.id) === String(roomB.id);
}
