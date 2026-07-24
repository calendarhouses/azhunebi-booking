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

/** Value stored on booking.cottage — chessboard name when available. */
export function adminRoomCottageValue(
  room: Pick<RoomConfig, "name" | "short"> | null | undefined
): string {
  if (!room) return "";
  return room.short?.trim() || room.name?.trim() || "";
}
