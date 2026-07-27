import type { RoomConfig } from "@/components/admin/desktop/types";

/**
 * Admin / chessboard label for a room.
 * Prefer `short` (шахматка); fall back to public `name` if short is empty.
 */
export function adminRoomLabel(
  room: Pick<RoomConfig, "name" | "short"> | null | undefined
): string {
  if (!room) return "Назва житла";
  const chessboard = room.short?.trim();
  if (chessboard) return chessboard;
  return room.name?.trim() || "Назва житла";
}

/**
 * Bare house number for the шахматка column ("Будиночок 7" → "7").
 * Returns null when the label has no digits (e.g. «Нерозподілені») so the
 * caller can fall back to the full name.
 */
export function adminRoomNumber(
  room: Pick<RoomConfig, "name" | "short"> | null | undefined
): string | null {
  const match = adminRoomLabel(room).match(/\d+/);
  return match ? match[0] : null;
}

/** Value stored on booking.cottage — chessboard name when available. */
export function adminRoomCottageValue(
  room: Pick<RoomConfig, "name" | "short"> | null | undefined
): string {
  if (!room) return "";
  return room.short?.trim() || room.name?.trim() || "";
}
