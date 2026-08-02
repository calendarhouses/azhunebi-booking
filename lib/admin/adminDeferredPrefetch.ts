import { fetchAdminDeferred, fetchAdminSync, getStoredAuthToken } from "@/lib/gas-api";
import type { AdminInitResponse } from "@/components/admin/desktop/types";

let deferredTenantId: string | null = null;
let deferredPromise: Promise<AdminInitResponse | null> | null = null;
let deferredResolved: AdminInitResponse | null = null;

let syncTenantId: string | null = null;
let syncPromise: Promise<AdminInitResponse | null> | null = null;

/**
 * One deferred enrich per tenant session — Strict Mode remounts reuse the result.
 */
export function fetchAdminDeferredOnce(tenantId: string): Promise<AdminInitResponse | null> {
  const id = tenantId.trim();
  if (!id) return Promise.resolve(null);
  if (deferredTenantId === id && deferredResolved) {
    return Promise.resolve(deferredResolved);
  }
  if (deferredTenantId === id && deferredPromise) return deferredPromise;

  deferredTenantId = id;
  deferredPromise = (async () => {
    try {
      const token = getStoredAuthToken();
      const data = await fetchAdminDeferred(id, token);
      deferredResolved = data;
      return data;
    } catch (err) {
      deferredPromise = null;
      throw err;
    }
  })();

  return deferredPromise;
}

/** Light silent sync — coalesce overlapping ticks. */
export function fetchAdminSyncOnce(tenantId: string): Promise<AdminInitResponse | null> {
  const id = tenantId.trim();
  if (!id) return Promise.resolve(null);
  if (syncTenantId === id && syncPromise) return syncPromise;

  syncTenantId = id;
  syncPromise = (async () => {
    try {
      const token = getStoredAuthToken();
      return await fetchAdminSync(id, token);
    } catch (err) {
      syncPromise = null;
      throw err;
    } finally {
      if (syncTenantId === id) {
        syncPromise = null;
      }
    }
  })();

  return syncPromise;
}

export function clearAdminDeferredPrefetch(): void {
  deferredTenantId = null;
  deferredPromise = null;
  deferredResolved = null;
  syncTenantId = null;
  syncPromise = null;
}
