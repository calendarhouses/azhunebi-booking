import { buildDefaultAmenitiesState } from "@/constants/amenitiesDict";
import type { RoomConfig } from "@/components/admin/desktop/types";

export function isRoomDraftId(id: number): boolean {
  return id < 0;
}

export function createDraftRoomConfig(): RoomConfig {
  const id = -Date.now();
  return {
    id,
    name: "",
    short: "",
    desc: "",
    capacity: 0,
    maxCapacity: 0,
    extraGuestPrice: 2500,
    priceWeekday: 0,
    priceWeekend: 0,
    active: false,
    availabilityStatus: "disabled",
    photos: [],
    detailedDescription: "",
    rules: {
      checkInTime: "15:00",
      checkOutTime: "11:00",
      pets: { isPetsFriendly: false, description: "За узгодженням" },
      selfCheckIn: { enabled: false, description: "" },
    },
    amenities: buildDefaultAmenitiesState(),
    siteHighlights: [],
  };
}
