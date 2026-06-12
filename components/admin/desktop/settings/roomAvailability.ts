import type { RoomAvailabilityStatus, RoomConfig } from "../types";

/** Лише два стани в UI (ремонт зведено до «вимкнено») */
export type RoomAvailabilityUiStatus = "enabled" | "disabled";

export function getRoomAvailabilityStatus(room: RoomConfig): RoomAvailabilityUiStatus {
  if (room.availabilityStatus === "enabled") return "enabled";
  if (
    room.availabilityStatus === "disabled" ||
    room.availabilityStatus === "maintenance"
  ) {
    return "disabled";
  }
  return room.active !== false ? "enabled" : "disabled";
}

export function patchFromAvailabilityStatus(
  status: RoomAvailabilityUiStatus
): Pick<RoomConfig, "availabilityStatus" | "active"> {
  return {
    availabilityStatus: status,
    active: status === "enabled",
  };
}

export const ROOM_STATUS_LABELS: Record<RoomAvailabilityUiStatus, string> = {
  enabled: "Увімкнено",
  disabled: "Вимкнено",
};
