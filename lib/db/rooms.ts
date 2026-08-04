import { apiRoomToDb, dbRoomToApi, getDb, type ApiRoom, type DbRoomRow } from "@/lib/db/mappers";
import { sortRoomsNumerically } from "@/lib/admin/sortRooms";

export { sortRoomsNumerically } from "@/lib/admin/sortRooms";

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

export async function deleteRoomById(id: string): Promise<boolean> {
  const sb = getDb();
  const { error, count } = await sb
    .from("rooms")
    .delete({ count: "exact" })
    .eq("id", String(id));
  if (error) throw new Error(`deleteRoom: ${error.message}`);
  return (count ?? 0) > 0;
}

/**
 * Full sync roomsList → rooms table (GAS syncRoomsSheet parity):
 * upsert every item, delete rows whose id is no longer in the list.
 */
export async function syncRoomsList(roomsList: ApiRoom[]): Promise<number> {
  const keepIds = new Set(
    roomsList
      .map((r) => String(r?.id ?? "").trim())
      .filter((id) => id.length > 0)
  );

  let n = 0;
  for (const room of sortRoomsNumerically(roomsList)) {
    if (!keepIds.has(String(room.id ?? "").trim())) continue;
    await upsertRoom(room);
    n += 1;
  }

  const existing = await listRooms();
  const orphans = existing.filter((r) => !keepIds.has(String(r.id)));

  // Guard against a bad/partial client payload wiping the whole catalog.
  if (keepIds.size === 0 && existing.length > 0) {
    console.warn(
      "[syncRoomsList] refusing to delete all rooms on empty roomsList; upserts only"
    );
  } else if (orphans.length) {
    for (const room of orphans) {
      await deleteRoomById(String(room.id));
    }
  }

  // Keep settings.roomsList blob in the same numeric order for any consumer
  // that still reads the JSON copy.
  const { saveSettingsKey } = await import("@/lib/db/settings");
  await saveSettingsKey("roomsList", await listRooms());
  return n;
}

export async function roomsChecksum(): Promise<{ count: number; ids: string[] }> {
  const rooms = await listRooms();
  const ids = rooms.map((r) => String(r.id)).sort((a, b) => Number(a) - Number(b));
  return { count: rooms.length, ids };
}
