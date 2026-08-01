import type { AdminInitResponse } from "@/components/admin/desktop/types";

const STORAGE_KEY = "azhunebi_admin_init_snapshot_v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // paint instantly; always refresh live after

type Snapshot = {
  tenantId: string;
  at: number;
  data: AdminInitResponse;
};

function readRaw(): Snapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot;
    if (!parsed?.tenantId || !parsed?.data?.settings || !Array.isArray(parsed.data.bookings)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Last successful admin boot — used only to paint UI while live data loads. */
export function readAdminInitSnapshot(tenantId: string): AdminInitResponse | null {
  const snap = readRaw();
  if (!snap || snap.tenantId !== tenantId) return null;
  if (Date.now() - snap.at > MAX_AGE_MS) return null;
  return snap.data;
}

export function writeAdminInitSnapshot(tenantId: string, data: AdminInitResponse): void {
  if (typeof window === "undefined" || !tenantId || !data?.settings) return;
  try {
    const snap: Snapshot = { tenantId, at: Date.now(), data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch {
    // Quota / private mode — ignore
  }
}

export function clearAdminInitSnapshot(tenantId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!tenantId) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const snap = readRaw();
    if (!snap || snap.tenantId === tenantId) {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}
