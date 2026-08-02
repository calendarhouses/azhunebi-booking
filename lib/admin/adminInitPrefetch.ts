import { fetchInitData } from "@/lib/gas-api";
import type { AdminInitResponse } from "@/components/admin/desktop/types";

let prefetchTenantId: string | null = null;
let prefetchPromise: Promise<AdminInitResponse> | null = null;

export function prefetchAdminInitData(tenantId: string, authToken: string): Promise<AdminInitResponse> {
  if (prefetchTenantId === tenantId && prefetchPromise) {
    return prefetchPromise;
  }
  prefetchTenantId = tenantId;
  prefetchPromise = fetchInitData(tenantId, authToken).catch((err) => {
    if (prefetchTenantId === tenantId) {
      prefetchTenantId = null;
      prefetchPromise = null;
    }
    throw err;
  });
  return prefetchPromise;
}

export function consumePrefetchedAdminInit(tenantId: string): Promise<AdminInitResponse> | null {
  if (!prefetchPromise || prefetchTenantId !== tenantId) return null;
  const promise = prefetchPromise;
  prefetchTenantId = null;
  prefetchPromise = null;
  return promise;
}

export function clearAdminInitPrefetch(): void {
  prefetchTenantId = null;
  prefetchPromise = null;
}
