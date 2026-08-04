import { apiRoomToDb, dbRoomToApi, getDb, type ApiRoom, type DbRoomRow } from "@/lib/db/mappers";

function roomSortKey(id: unknown): number {
  const n = Number(id);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

/** Numeric id order (1,2,10) — rooms.id is text in Postgres so SQL ORDER BY is lexical. */
export function sortRoomsNumerically<T extends { id?: unknown }>(rooms: T[]): T[] {
  return [...rooms].sort((a, b) => {
    const d = roomSortKey(a.id) - roomSortKey(b.id);
    if (d !== 0) return d;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""), "uk");
  });
}

export async function listRooms(): Promise<ApiRoom[]> {
  const sb = getDb();
  const { data, error } = await sb.from("rooms").select("*");
  if (error) throw new Error(`listRooms: ${error.message}`);
  return sortRoomsNumerically((data as DbRoomRow[]).map(dbRoomToApi));
}

export async function upsertRoom(api: ApiRoom): Promise<ApiRoom> {
  const row = apiRoomToDb(api);
  if (!row) throw new Error("upsertRoom: missing id");
  const sb = getDb();
  const { error } = await sb.from("rooms").upsert(row, { onConflict: "id" });
  if (error) throw new Error(`upsertRoom: ${error.message}`);
  const rooms = await listRooms();
  const found = rooms.find((r) => String(r.id) === String(row.id));
  if (!found) throw new Error("upsertRoom: missing after write");
  return found;
}

export async function syncRoomsList(roomsList: ApiRoom[]): Promise<number> {
  let n = 0;
  for (const room of roomsList) {
    await upsertRoom(room);
    n += 1;
  }
  return n;
}

export async function roomsChecksum(): Promise<{ count: number; ids: string[] }> {
  const rooms = await listRooms();
  const ids = rooms.map((r) => String(r.id)).sort();
  return { count: rooms.length, ids };
}
