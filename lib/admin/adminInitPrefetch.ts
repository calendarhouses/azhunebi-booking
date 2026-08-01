import { fetchInitData } from "@/lib/gas-api";
import type { AdminInitResponse } from "@/components/admin/desktop/types";

let prefetchTenantId: string | null = null;
let prefetchPromise: Promise<AdminInitResponse> | null = null;

export function prefetchAdminInitData(tenantId: string, authToken: string): Promise<AdminInitResponse> {
  if (prefetchTenantId === tenantId && prefetchPromise) {
    return prefetchPromise;
  }
  prefetchTenantId = tenantId;
  const promise = fetchInitData(tenantId, authToken).then(
    (data) => {
      // Keep resolved data reusable briefly; clear only after consume or newer prefetch.
      return data;
    },
    (err) => {
      if (prefetchPromise === promise) {
        prefetchTenantId = null;
        prefetchPromise = null;
      }
      throw err;
    }
  );
  prefetchPromise = promise;
  return promise;
}

/** Peek in-flight/resolved prefetch without dropping it (safe for concurrent boot). */
export function consumePrefetchedAdminInit(tenantId: string): Promise<AdminInitResponse> | null {
  if (!prefetchPromise || prefetchTenantId !== tenantId) return null;
  const promise = prefetchPromise;
  return promise.finally(() => {
    // Drop cache after this generation settles so the next visit re-fetches fresh data.
    if (prefetchPromise === promise) {
      prefetchTenantId = null;
      prefetchPromise = null;
    }
  });
}

export function clearAdminInitPrefetch(): void {
  prefetchTenantId = null;
  prefetchPromise = null;
}
