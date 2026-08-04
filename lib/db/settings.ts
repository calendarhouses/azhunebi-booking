import { getDb } from "@/lib/db/mappers";
import { listRooms, syncRoomsList } from "@/lib/db/rooms";
import type { ApiRoom } from "@/lib/db/mappers";

export async function loadAllSettings(): Promise<Record<string, unknown>> {
  const sb = getDb();
  const { data, error } = await sb.from("settings").select("key, value");
  if (error) throw new Error(`loadAllSettings: ${error.message}`);
  const out: Record<string, unknown> = {};
  for (const row of data || []) {
    if (row.key === "__keepalive") continue;
    out[row.key] = row.value;
  }
  out.roomsList = await listRooms();
  return out;
}

export async function getSettingsPayload(opts?: {
  omitSms?: boolean;
  omitTransactions?: boolean;
  omitTeam?: boolean;
  stripSmsJournal?: boolean;
}): Promise<Record<string, unknown>> {
  const settings = await loadAllSettings();
  const out = { ...settings };

  if (opts?.omitTeam !== false) {
    delete out.teamMembers;
  }
  delete out.activityLog;

  if (opts?.omitSms) delete out.smsSettings;
  if (opts?.omitTransactions) delete out.transactions;

  if (opts?.stripSmsJournal && out.smsSettings && typeof out.smsSettings === "object") {
    out.smsSettings = { ...(out.smsSettings as object), journal: [] };
  }

  return out;
}

export async function saveSettingsKey(key: string, value: unknown): Promise<void> {
  const sb = getDb();
  const { error } = await sb.from("settings").upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(`saveSettingsKey(${key}): ${error.message}`);
}

export async function saveSettingsMerge(
  incoming: Record<string, unknown>,
  saveKeys?: string[]
): Promise<void> {
  const keys =
    Array.isArray(saveKeys) && saveKeys.length ? saveKeys : Object.keys(incoming);

  let roomsSynced = false;

  for (const key of keys) {
    if (key === "teamMembers" || key === "activityLog" || key === "__keepalive") continue;
    if (!(key in incoming)) continue;

    if (key === "roomsList" && Array.isArray(incoming.roomsList)) {
      await syncRoomsList(incoming.roomsList as ApiRoom[]);
      roomsSynced = true;
      continue;
    }

    await saveSettingsKey(key, incoming[key]);
  }

  // Drop orphan per-room price/rule keys after a room catalog sync.
  if (roomsSynced) {
    await pruneOrphanRoomKeyedSettings();
  }
}

/** Remove customPrices / restrictions / closedDates entries for deleted room ids. */
async function pruneOrphanRoomKeyedSettings(): Promise<void> {
  const rooms = await listRooms();
  const keep = new Set(rooms.map((r) => String(r.id)));
  if (!keep.size) return;

  const all = await loadAllSettings();
  for (const key of ["customPrices", "restrictions", "closedDates"] as const) {
    const raw = all[key];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const map = raw as Record<string, unknown>;
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [roomId, value] of Object.entries(map)) {
      if (keep.has(String(roomId))) {
        next[roomId] = value;
      } else {
        changed = true;
      }
    }
    if (changed) await saveSettingsKey(key, next);
  }
}

export async function touchKeepAlive(): Promise<string> {
  const now = new Date().toISOString();
  await saveSettingsKey("__keepalive", now);
  return now;
}

export async function settingsChecksum(): Promise<{ keys: string[]; count: number }> {
  const all = await loadAllSettings();
  const keys = Object.keys(all).filter((k) => k !== "roomsList").sort();
  return { keys, count: keys.length };
}
