import { patchFromAvailabilityStatus } from "@/components/admin/desktop/settings/roomAvailability";
import type { RoomConfig } from "@/components/admin/desktop/types";

export type PublishingRequirement = "name" | "capacity" | "photos" | "price";

export type PublishingValidationResult =
  | { ok: true }
  | { ok: false; missing: PublishingRequirement[] };

export type PublishingRoomFields = Pick<
  RoomConfig,
  "name" | "capacity" | "photos" | "priceWeekday" | "priceWeekend"
>;

const REQUIREMENT_LABELS: Record<PublishingRequirement, string> = {
  name: "назву",
  capacity: "місткість основних місць",
  photos: "хоча б одне фото",
  price: "базову ціну",
};

function joinRequirementLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} та ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} та ${labels[labels.length - 1]}`;
}

export function validatePublishing(room: PublishingRoomFields): PublishingValidationResult {
  const missing: PublishingRequirement[] = [];

  if (!room.name?.trim()) missing.push("name");
  if (!(Number(room.capacity) > 0)) missing.push("capacity");
  if (!((room.photos?.length ?? 0) >= 1)) missing.push("photos");
  if (!(Number(room.priceWeekday) > 0 || Number(room.priceWeekend) > 0)) {
    missing.push("price");
  }

  if (missing.length > 0) return { ok: false, missing };
  return { ok: true };
}

export function formatPublishingErrorMessage(missing: PublishingRequirement[]): string {
  const labels = missing.map((key) => REQUIREMENT_LABELS[key]);
  return `Не можемо увімкнути житло. Додай ${joinRequirementLabels(labels)}.`;
}

export function applyPublishingAvailability(room: RoomConfig): RoomConfig {
  const canPublish = validatePublishing(room).ok;
  return {
    ...room,
    ...patchFromAvailabilityStatus(canPublish ? "enabled" : "disabled"),
  };
}
