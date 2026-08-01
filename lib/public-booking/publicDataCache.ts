import "server-only";

import { fetchInitData, fetchPublicTenantData } from "@/lib/gas-api";
import type { AdminInitResponse } from "@/components/admin/desktop/types";
import type { PublicTenantPayload } from "@/lib/public-booking/types";

type Entry<T> = {
  value: T;
  at: number;
  inFlight: Promise<T> | null;
};

type CacheOptions<T> = {
  /** Serve from memory without touching GAS. */
  freshMs: number;
  /** Serve stale immediately and refresh in the background. */
  staleMs: number;
  load: (key: string) => Promise<T>;
};

/**
 * GAS answers in 4-20s, so every uncached page render blocks on it. Keeping a
 * short-lived copy in lambda memory turns that into a single slow request per
 * window instead of one per visitor.
 */
function createSwrCache<T>(options: CacheOptions<T>) {
  const store = new Map<string, Entry<T>>();

  const refresh = (key: string, entry: Entry<T> | undefined): Promise<T> => {
    const existing = entry?.inFlight;
    if (existing) return existing;

    const promise = options
      .load(key)
      .then((value) => {
        store.set(key, { value, at: Date.now(), inFlight: null });
        return value;
      })
      .catch((err) => {
        const current = store.get(key);
        if (current) current.inFlight = null;
        throw err;
      });

    if (entry) entry.inFlight = promise;
    else store.set(key, { value: undefined as T, at: 0, inFlight: promise });
    return promise;
  };

  return async function get(key: string): Promise<T> {
    const entry = store.get(key);
    const age = entry && entry.at ? Date.now() - entry.at : Infinity;

    if (entry?.at && age < options.freshMs) return entry.value;

    if (entry?.at && age < options.staleMs) {
      // Stale-while-revalidate: answer now, warm the cache for the next visitor.
      void refresh(key, entry).catch(() => undefined);
      return entry.value;
    }

    try {
      return await refresh(key, entry);
    } catch (err) {
      if (entry?.at) return entry.value;
      throw err;
    }
  };
}

const tenantCache = createSwrCache<PublicTenantPayload>({
  freshMs: 60_000,
  staleMs: 30 * 60_000,
  // Throwing keeps a failed lookup out of the cache (null would stick for a minute).
  load: async (tenantId) => {
    const data = await fetchPublicTenantData(tenantId);
    if (!data) throw new Error(`Tenant not found: ${tenantId}`);
    return data;
  },
});

const initCache = createSwrCache<AdminInitResponse>({
  freshMs: 30_000,
  staleMs: 30 * 60_000,
  load: (tenantId) => fetchInitData(tenantId),
});

export async function getCachedPublicTenantData(
  tenantId: string
): Promise<PublicTenantPayload | null> {
  try {
    return await tenantCache(tenantId);
  } catch {
    return null;
  }
}

export function getCachedPublicInitData(tenantId: string): Promise<AdminInitResponse> {
  return initCache(tenantId);
}
