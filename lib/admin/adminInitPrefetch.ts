import { fetchInitData } from "@/lib/gas-api";
import type { AdminInitResponse } from "@/components/admin/desktop/types";

let prefetchTenantId: string | null = null;
let prefetchPromise: Promise<AdminInitResponse> | null = null;
let prefetchAppliedTenant: string | null = null;

export function prefetchAdminInitData(tenantId: string, authToken: string): Promise<AdminInitResponse> {
  if (prefetchTenantId === tenantId && prefetchPromise) {
    return prefetchPromise;
  }
  prefetchTenantId = tenantId;
  prefetchAppliedTenant = null;
  prefetchPromise = fetchInitData(tenantId, authToken).catch((err) => {
    if (prefetchTenantId === tenantId) {
      prefetchTenantId = null;
      prefetchPromise = null;
    }
    throw err;
  });
  return prefetchPromise;
}

/**
 * Reuse in-flight (or completed-but-not-released) prefetch.
 * Does NOT clear — call releasePrefetchedAdminInit after successful apply.
 */
export function consumePrefetchedAdminInit(tenantId: string): Promise<AdminInitResponse> | null {
  if (!prefetchPromise || prefetchTenantId !== tenantId) return null;
  if (prefetchAppliedTenant === tenantId) return null;
  return prefetchPromise;
}

export function releasePrefetchedAdminInit(tenantId: string): void {
  if (prefetchTenantId === tenantId) {
    prefetchAppliedTenant = tenantId;
    prefetchTenantId = null;
    prefetchPromise = null;
  }
}

export function clearAdminInitPrefetch(): void {
  prefetchTenantId = null;
  prefetchPromise = null;
  prefetchAppliedTenant = null;
}
