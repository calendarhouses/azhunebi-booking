import type { RoomCategory, RoomConfig } from "@/components/admin/desktop/types";
import { sortRoomsNumerically } from "@/lib/admin/sortRooms";

export const UNCATEGORIZED_ID = "__none__";

export function houseWord(n: number): string {
  const v = Math.abs(Math.round(n)) % 100;
  const v1 = v % 10;
  if (v > 10 && v < 20) return "будинків";
  if (v1 === 1) return "будинок";
  if (v1 > 1 && v1 < 5) return "будинки";
  return "будинків";
}

export function normalizeRoomCategories(raw: unknown): RoomCategory[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: RoomCategory[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const id = String(rec.id || "").trim();
    const name = String(rec.name || "").trim();
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name,
      sort: Number.isFinite(Number(rec.sort)) ? Number(rec.sort) : out.length,
      hidden: rec.hidden === true,
    });
  }
  return out.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, "uk"));
}

export function visibleRoomCategories(list: RoomCategory[] | undefined | null): RoomCategory[] {
  return normalizeRoomCategories(list).filter((c) => !c.hidden);
}

export function categoryNameById(
  list: RoomCategory[] | undefined | null,
  categoryId?: string | null
): string | null {
  const id = String(categoryId || "").trim();
  if (!id) return null;
  return normalizeRoomCategories(list).find((c) => c.id === id)?.name ?? null;
}

export type RoomCategoryGroup<T extends { categoryId?: string | null }> = {
  id: string;
  title: string;
  rooms: T[];
};

export function groupRoomsByCategory<
  T extends { categoryId?: string | null; id?: unknown; name?: unknown; short?: unknown },
>(
  rooms: T[],
  categories: RoomCategory[] | undefined | null
): RoomCategoryGroup<T>[] {
  const cats = normalizeRoomCategories(categories);
  const byId = new Map<string, T[]>();
  for (const cat of cats) byId.set(cat.id, []);
  const uncategorized: T[] = [];

  for (const room of sortRoomsNumerically(rooms)) {
    const id = String(room.categoryId || "").trim();
    if (id && byId.has(id)) {
      byId.get(id)!.push(room);
    } else {
      uncategorized.push(room);
    }
  }

  const groups: RoomCategoryGroup<T>[] = [];
  for (const cat of cats) {
    const list = byId.get(cat.id) || [];
    if (!list.length) continue;
    groups.push({ id: cat.id, title: cat.name, rooms: list });
  }
  if (uncategorized.length) {
    groups.push({
      id: UNCATEGORIZED_ID,
      title: cats.length ? "Без категорії" : "",
      rooms: uncategorized,
    });
  }
  return groups;
}

export function sortRoomsByCategory<T extends RoomConfig>(
  rooms: T[],
  categories: RoomCategory[] | undefined | null
): T[] {
  return groupRoomsByCategory(rooms, categories).flatMap((g) => g.rooms);
}

export function newRoomCategoryId(): string {
  return `cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export const TIMELINE_CATEGORY_HEAD_H = 34;

export type TimelineLane =
  | { kind: "header"; id: string; title: string; count: number }
  | { kind: "room"; roomIndex: number };

export function buildTimelineLanes<T extends { id?: unknown; categoryId?: string | null }>(
  rooms: T[],
  categories: RoomCategory[] | undefined | null,
  holdingId: unknown
): TimelineLane[] {
  const cats = normalizeRoomCategories(categories);
  const holding: T[] = [];
  const rest: T[] = [];
  for (const room of rooms) {
    if (room.id === holdingId) holding.push(room);
    else rest.push(room);
  }

  const lanes: TimelineLane[] = [];
  if (!cats.length) {
    rest.forEach((_, i) => lanes.push({ kind: "room", roomIndex: i }));
    holding.forEach((_, i) => lanes.push({ kind: "room", roomIndex: rest.length + i }));
    return lanes;
  }

  let roomIndex = 0;
  for (const group of groupRoomsByCategory(rest, cats)) {
    if (group.title) {
      lanes.push({
        kind: "header",
        id: group.id,
        title: group.title,
        count: group.rooms.length,
      });
    }
    for (const _ of group.rooms) {
      lanes.push({ kind: "room", roomIndex });
      roomIndex += 1;
    }
  }
  holding.forEach((_, i) => lanes.push({ kind: "room", roomIndex: roomIndex + i }));
  return lanes;
}

export function roomTopFromLanes(
  roomIndex: number,
  lanes: TimelineLane[],
  rowHeight: number,
  headerHeight = TIMELINE_CATEGORY_HEAD_H
): number {
  let y = 0;
  for (const lane of lanes) {
    if (lane.kind === "room" && lane.roomIndex === roomIndex) return y;
    y += lane.kind === "header" ? headerHeight : rowHeight;
  }
  return roomIndex * rowHeight;
}

export function roomIndexFromLaneY(
  offsetY: number,
  lanes: TimelineLane[],
  roomCount: number,
  rowHeight: number,
  headerHeight = TIMELINE_CATEGORY_HEAD_H
): number {
  if (roomCount <= 0) return 0;
  let y = offsetY;
  let lastRoom = 0;
  let pendingRoom: number | null = null;
  for (const lane of lanes) {
    const h = lane.kind === "header" ? headerHeight : rowHeight;
    if (y < h) {
      if (lane.kind === "room") return lane.roomIndex;
      pendingRoom = lastRoom;
      break;
    }
    y -= h;
    if (lane.kind === "room") lastRoom = lane.roomIndex;
  }
  if (pendingRoom != null) {
    const next = lanes.find(
      (lane) => lane.kind === "room" && lane.roomIndex >= pendingRoom!
    );
    if (next && next.kind === "room") return next.roomIndex;
  }
  return Math.max(0, Math.min(roomCount - 1, lastRoom));
}
