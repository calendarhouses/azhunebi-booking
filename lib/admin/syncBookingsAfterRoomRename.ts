import { gasPost } from "@/lib/gas-api";
import {
  bookingBelongsToRoom,
  findRoomForBooking,
  normalizeRoomLabel,
  type RoomLike,
} from "@/lib/admin/roomBookingMatch";

/** Оновлює cottage/roomId у бронях після перейменування житла в налаштуваннях. */
export async function syncBookingsAfterRoomListChange(
  tenantId: string,
  oldRooms: RoomLike[],
  newRooms: RoomLike[],
  authToken?: string | null
): Promise<void> {
  if (!newRooms.length) return;

  try {
    await gasPost(
      {
        action: "syncBookingsAfterRoomRename",
        tenant_id: tenantId,
        oldRooms,
        newRooms,
      },
      { authToken }
    );
  } catch (err) {
    console.error("syncBookingsAfterRoomListChange:", err);
  }
}
