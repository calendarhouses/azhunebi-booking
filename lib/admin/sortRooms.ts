/**
 * Shared numeric room ordering for admin UI + DAL.
 * Prefer numeric `id`, then cottage number from short/name ("Будиночок 10" → 10).
 */

export function roomIdSortKey(id: unknown): number {
  const n = Number(id);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

export function roomLabelSortKey(room: {
  id?: unknown;
  name?: unknown;
  short?: unknown;
}): number {
  const byId = roomIdSortKey(room.id);
  if (Number.isFinite(byId) && byId !== Number.POSITIVE_INFINITY) return byId;
  const label = String(room.short || room.name || "");
  const m = label.match(/(\d+)/);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

export function sortRoomsNumerically<T extends { id?: unknown; name?: unknown; short?: unknown }>(
  rooms: T[]
): T[] {
  return [...rooms].sort((a, b) => {
    const d = roomLabelSortKey(a) - roomLabelSortKey(b);
    if (d !== 0) return d;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""), "uk", { numeric: true });
  });
}
