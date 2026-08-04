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

  for (const key of keys) {
    if (key === "teamMembers" || key === "activityLog" || key === "__keepalive") continue;
    if (!(key in incoming)) continue;

    if (key === "roomsList" && Array.isArray(incoming.roomsList)) {
      await syncRoomsList(incoming.roomsList as ApiRoom[]);
      await saveSettingsKey("roomsList", incoming.roomsList);
      continue;
    }

    await saveSettingsKey(key, incoming[key]);
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
