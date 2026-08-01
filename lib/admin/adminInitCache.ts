import type { AdminInitResponse } from "@/components/admin/desktop/types";

const KEY_PREFIX = "admin_init_snapshot_v1:";
/** Snapshots older than this are ignored (stale data is worse than a spinner). */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

type Snapshot = {
  savedAt: number;
  data: AdminInitResponse;
};

function storageKey(tenantId: string): string {
  return `${KEY_PREFIX}${tenantId}`;
}

export function readAdminInitSnapshot(tenantId: string): AdminInitResponse | null {
  if (typeof window === "undefined" || !tenantId) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot;
    if (!parsed?.data || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    if (!Array.isArray(parsed.data.bookings) || !parsed.data.settings) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeAdminInitSnapshot(tenantId: string, data: AdminInitResponse): void {
  if (typeof window === "undefined" || !tenantId || !data?.settings) return;
  try {
    const snapshot: Snapshot = { savedAt: Date.now(), data };
    window.localStorage.setItem(storageKey(tenantId), JSON.stringify(snapshot));
  } catch {
    // Quota exceeded / private mode — cache is best-effort only.
  }
}

export function clearAdminInitSnapshot(tenantId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (tenantId) {
      window.localStorage.removeItem(storageKey(tenantId));
      return;
    }
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(KEY_PREFIX)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
