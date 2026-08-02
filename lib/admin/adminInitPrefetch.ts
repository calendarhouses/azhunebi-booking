import { fetchAdminChessboard } from "@/lib/gas-api";
import type { AdminInitResponse } from "@/components/admin/desktop/types";

let prefetchTenantId: string | null = null;
let prefetchPromise: Promise<AdminInitResponse> | null = null;
/** Keep resolved chessboard so Strict Mode remount does not refetch. */
let prefetchResolved: AdminInitResponse | null = null;
let prefetchResolvedAt = 0;

const PREFETCH_TTL_MS = 60_000;

/**
 * Warm Stage-A chessboard payload (rooms + slim bookings) during login / auth.
 * Does NOT prefetch the heavy adminDeferred dump — that runs after paint.
 */
export function prefetchAdminInitData(tenantId: string, authToken: string): Promise<AdminInitResponse> {
  if (
    prefetchResolved &&
    prefetchTenantId === tenantId &&
    Date.now() - prefetchResolvedAt < PREFETCH_TTL_MS
  ) {
    return Promise.resolve(prefetchResolved);
  }
  if (prefetchTenantId === tenantId && prefetchPromise) {
    return prefetchPromise;
  }
  prefetchTenantId = tenantId;
  prefetchPromise = fetchAdminChessboard(tenantId, authToken)
    .then((data) => {
      prefetchResolved = data;
      prefetchResolvedAt = Date.now();
      return data;
    })
    .catch((err) => {
      if (prefetchTenantId === tenantId) {
        prefetchPromise = null;
        // Keep tenant id so a concurrent consumer can retry cleanly.
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
  if (prefetchTenantId !== tenantId) return null;
  if (
    prefetchResolved &&
    Date.now() - prefetchResolvedAt < PREFETCH_TTL_MS
  ) {
    return Promise.resolve(prefetchResolved);
  }
  if (!prefetchPromise) return null;
  return prefetchPromise;
}

/**
 * No-op for successful apply — keep cache for remounts.
 * Prefer clearAdminInitPrefetch on logout / tenant loss.
 */
export function releasePrefetchedAdminInit(_tenantId: string): void {
  // Intentionally keep resolved chessboard for Strict Mode / mobile remount.
}

export function clearAdminInitPrefetch(): void {
  prefetchTenantId = null;
  prefetchPromise = null;
  prefetchResolved = null;
  prefetchResolvedAt = 0;
}
