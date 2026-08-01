import type { AdminInitResponse } from "@/components/admin/desktop/types";

const KEY_PREFIX = "public_init_snapshot_v1:";
/**
 * Short TTL on purpose: the snapshot drives calendar availability, so stale
 * bookings must expire quickly. Availability is re-checked server-side anyway.
 */
const MAX_AGE_MS = 5 * 60 * 1000;

type Snapshot = {
  savedAt: number;
  data: AdminInitResponse;
};

function storageKey(tenantId: string): string {
  return `${KEY_PREFIX}${tenantId}`;
}

export function readPublicInitSnapshot(tenantId: string): AdminInitResponse | null {
  if (typeof window === "undefined" || !tenantId) return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(tenantId));
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

export function writePublicInitSnapshot(tenantId: string, data: AdminInitResponse): void {
  if (typeof window === "undefined" || !tenantId || !data?.settings) return;
  try {
    const snapshot: Snapshot = { savedAt: Date.now(), data };
    window.sessionStorage.setItem(storageKey(tenantId), JSON.stringify(snapshot));
  } catch {
    // Quota exceeded / private mode — cache is best-effort only.
  }
}
