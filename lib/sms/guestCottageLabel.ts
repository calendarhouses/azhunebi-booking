import "server-only";

import type { RoomLike } from "@/lib/admin/roomBookingMatch";
import { listRooms } from "@/lib/db/rooms";
import { publicCottageLabel } from "@/lib/public-booking/publicCottageLabel";

const ROOMS_TTL_MS = 5 * 60_000;

let cached: { rooms: RoomLike[]; at: number } | null = null;

async function loadPublicRooms(): Promise<RoomLike[]> {
  if (cached && Date.now() - cached.at < ROOMS_TTL_MS) return cached.rooms;
  try {
    const rooms = (await listRooms()) as RoomLike[];
    if (rooms.length) cached = { rooms, at: Date.now() };
    return rooms;
  } catch (err) {
    console.warn("[SMS] Failed to load rooms for cottage label", err);
    return cached?.rooms || [];
  }
}

/**
 * Public listing name of the booked house, for texts the guest receives.
 * Bookings store the chessboard number, which staff need but guests never saw.
 * Returns undefined when the lookup fails so callers keep their own fallback.
 */
export async function guestCottageLabel(booking: {
  cottage?: string;
  roomId?: string | number | null;
}): Promise<string | undefined> {
  const rooms = await loadPublicRooms();
  if (!rooms.length) return undefined;
  return publicCottageLabel(booking, rooms, "") || undefined;
}
