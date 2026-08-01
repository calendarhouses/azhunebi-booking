import { fetchInitData } from "@/lib/gas-api";
import type { AdminInitResponse } from "@/components/admin/desktop/types";

let prefetchTenantId: string | null = null;
let prefetchPromise: Promise<AdminInitResponse> | null = null;

export function prefetchAdminInitData(tenantId: string, authToken: string): Promise<AdminInitResponse> {
  if (prefetchTenantId === tenantId && prefetchPromise) {
    return prefetchPromise;
  }
  prefetchTenantId = tenantId;
  prefetchPromise = fetchInitData(tenantId, authToken)
    .then((data) => data)
    .catch((err) => {
      if (prefetchTenantId === tenantId) {
        prefetchTenantId = null;
        prefetchPromise = null;
      }
      throw err;
    });
  return prefetchPromise;
}

/**
 * Reuse in-flight or completed prefetch for this tenant.
 * Safe across Strict Mode remounts — does not clear the promise.
 */
export function consumePrefetchedAdminInit(tenantId: string): Promise<AdminInitResponse> | null {
  if (!prefetchPromise || prefetchTenantId !== tenantId) return null;
  return prefetchPromise;
}

/** Clear after successful apply (or sign-out). */
export function releasePrefetchedAdminInit(tenantId: string): void {
  if (prefetchTenantId === tenantId) {
    prefetchTenantId = null;
    prefetchPromise = null;
  }
}

export function clearAdminInitPrefetch(): void {
  prefetchTenantId = null;
  prefetchPromise = null;
}
