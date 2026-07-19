import type { RoomConfig } from "../types";
import { formatChildrenPolicyBadge } from "./additionalServicesLogic";

export function guestsPlural(count: number): string {
  const n = Math.abs(Math.trunc(count));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "особа";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "особи";
  return "осіб";
}

export function formatCapacityLabel(room: Pick<RoomConfig, "capacity" | "maxCapacity">): string {
  const base = room.capacity;
  const max = room.maxCapacity ?? room.capacity;
  if (max <= base) {
    return `${base} ${guestsPlural(base)}`;
  }
  return `${base} (до ${max}) ${guestsPlural(max)}`;
}

/** Місткість + короткий бейдж політики дітей для списку будинків. */
export function formatCapacityWithChildrenLabel(
  room: Pick<RoomConfig, "capacity" | "maxCapacity" | "allowChildren" | "minChildAge">
): string {
  const base = formatCapacityLabel(room);
  const badge = formatChildrenPolicyBadge(room);
  if (!badge) return base;
  return `${base} · ${badge}`;
}
