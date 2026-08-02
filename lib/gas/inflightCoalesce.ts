/**
 * In-flight coalesce for identical GAS read actions within one Node process.
 * Prevents reopen / prefetch / remount from stacking parallel full dumps.
 */

type InflightEntry = {
  promise: Promise<string>;
  startedAt: number;
};

const inflight = new Map<string, InflightEntry>();

export function coalesceKey(parts: {
  method: string;
  action: string;
  tenant?: string | null;
  tokenFingerprint?: string | null;
}): string {
  return [
    parts.method,
    parts.action || "",
    parts.tenant || "",
    parts.tokenFingerprint ? parts.tokenFingerprint.slice(0, 12) : "",
  ].join("|");
}

export async function withGasInflightCoalesce(
  key: string,
  run: () => Promise<string>
): Promise<{ text: string; shared: boolean }> {
  const existing = inflight.get(key);
  if (existing) {
    const text = await existing.promise;
    return { text, shared: true };
  }

  let resolve!: (v: string) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  inflight.set(key, { promise, startedAt: Date.now() });

  try {
    const text = await run();
    resolve(text);
    return { text, shared: false };
  } catch (err) {
    reject(err);
    throw err;
  } finally {
    inflight.delete(key);
  }
}

/** Short-TTL response cache for occupancy-critical reads (max 10s). */
type CacheEntry = { body: string; status: number; expiresAt: number };
const shortCache = new Map<string, CacheEntry>();
let cacheGeneration = 0;

export function bumpGasCacheGeneration(): number {
  cacheGeneration += 1;
  shortCache.clear();
  return cacheGeneration;
}

export function getGasCacheGeneration(): number {
  return cacheGeneration;
}

export function readGasShortCache(
  key: string
): { body: string; status: number } | null {
  const hit = shortCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    shortCache.delete(key);
    return null;
  }
  // Drop poisoned entries from older deploys.
  if (!isSuccessfulGasReadBody(hit.body)) {
    shortCache.delete(key);
    return null;
  }
  return { body: hit.body, status: hit.status };
}

export function writeGasShortCache(
  key: string,
  body: string,
  status: number,
  ttlMs: number
): void {
  if (ttlMs <= 0 || status !== 200) return;
  if (!isSuccessfulGasReadBody(body)) return;
  shortCache.set(key, {
    body,
    status,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * GAS always returns HTTP 200, even for UNAUTHORIZED. Never cache / coalesce
 * those bodies — they would poison the whole tenant for 60s.
 */
export function isSuccessfulGasReadBody(body: string): boolean {
  if (!body || !body.trim()) return false;
  try {
    const data = JSON.parse(body) as Record<string, unknown>;
    if (!data || typeof data !== "object") return false;
    if (data.error) return false;
    if (data.success === false) return false;
    return true;
  } catch {
    return false;
  }
}

export const OCCUPANCY_CACHE_TTL_MS = 8_000;
/** Stage-A: chessboard / sync payloads — longer so reopen is near-instant. */
export const CHESSBOARD_CACHE_TTL_MS = 60_000;
export const SETTINGS_CACHE_TTL_MS = 120_000;

export function isCoalescableGasAction(action: string | null | undefined): boolean {
  const a = String(action || "");
  return (
    a === "initData" ||
    a === "adminInitData" ||
    a === "adminChessboard" ||
    a === "adminDeferred" ||
    a === "adminSync" ||
    a === "adminBoot" ||
    a === "fetchPublicTenant" ||
    a === "settings" ||
    a === "getAllBookings" ||
    a === "getGuestProfiles"
  );
}

export function isOccupancyCriticalAction(action: string | null | undefined): boolean {
  const a = String(action || "");
  return (
    a === "initData" ||
    a === "adminInitData" ||
    a === "adminChessboard" ||
    a === "adminSync" ||
    a === "getAllBookings"
  );
}

/**
 * Same-tenant admin reads (chessboard/deferred/…) are identical for every
 * logged-in teammate. Keying by token made PC+phone dig twice into GAS.
 * Session-specific actions (adminBoot) still include the token fingerprint.
 */
export function actionCacheUsesToken(action: string | null | undefined): boolean {
  const a = String(action || "");
  return a === "adminBoot";
}

export function gasActionCacheTtlMs(action: string | null | undefined): number {
  const a = String(action || "");
  if (a === "adminChessboard" || a === "adminSync") return CHESSBOARD_CACHE_TTL_MS;
  if (a === "adminDeferred" || a === "settings") return SETTINGS_CACHE_TTL_MS;
  if (a === "getGuestProfiles") return SETTINGS_CACHE_TTL_MS;
  if (a === "adminBoot" || a === "fetchPublicTenant") return OCCUPANCY_CACHE_TTL_MS;
  if (isOccupancyCriticalAction(a)) return OCCUPANCY_CACHE_TTL_MS;
  return 0;
}
