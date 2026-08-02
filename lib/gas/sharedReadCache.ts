/**
 * Cross-instance GAS read cache via Upstash Redis.
 * Without UPSTASH_REDIS_REST_URL/TOKEN this is a no-op (local Map only).
 *
 * - Generation-busted keys: fresh after writes (TTL ~30s)
 * - Last-good keys: survive invalidation; used when GAS times out
 * - Singleflight lock: one GAS fetch per cacheKey across Vercel isolates
 */

import { Redis } from "@upstash/redis";
import {
  bumpGasCacheGeneration,
  isOccupancyCriticalAction,
  isSuccessfulGasReadBody,
} from "@/lib/gas/inflightCoalesce";

const GEN_KEY = "gas:read:gen";
const KEY_PREFIX = "gas:read:";
const LAST_GOOD_PREFIX = "gas:lastgood:";
const LOCK_PREFIX = "gas:lock:";
const LOCK_RESULT_PREFIX = "gas:lockres:";

const LAST_GOOD_TTL_SEC = 15 * 60;
const LOCK_TTL_SEC = 55;

type SharedEntry = {
  body: string;
  status: number;
};

let redisSingleton: Redis | null | undefined;
/** Last seen Redis generation in this isolate — mismatch clears local Map. */
let localSeenGen: string | null = null;

function getRedis(): Redis | null {
  if (redisSingleton !== undefined) return redisSingleton;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redisSingleton = null;
    return null;
  }
  redisSingleton = new Redis({ url, token });
  return redisSingleton;
}

export function isSharedReadCacheConfigured(): boolean {
  return Boolean(getRedis());
}

/**
 * Never cache empty cottage lists for boot/occupancy reads — GAS under
 * queue pressure sometimes returns success with roomsList: [].
 */
export function isCacheableGasReadBody(
  action: string | null | undefined,
  body: string
): boolean {
  if (!isSuccessfulGasReadBody(body)) return false;
  try {
    const data = JSON.parse(body) as {
      settings?: { roomsList?: unknown };
      rooms?: unknown;
    };
    if (isOccupancyCriticalAction(action) || action === "adminDeferred") {
      const rooms = data.settings?.roomsList;
      if (Array.isArray(rooms) && rooms.length === 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function currentGeneration(redis: Redis): Promise<string> {
  try {
    const gen = await redis.get<string | number>(GEN_KEY);
    return gen == null ? "0" : String(gen);
  } catch (err) {
    console.warn("[sharedReadCache] gen read failed:", err);
    return "0";
  }
}

/**
 * If another instance invalidated Redis, drop this isolate's memory cache
 * so we don't serve up to 30s of stale HIT after a write.
 */
export async function syncSharedCacheGeneration(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const gen = await currentGeneration(redis);
    if (localSeenGen !== null && localSeenGen !== gen) {
      bumpGasCacheGeneration();
    }
    localSeenGen = gen;
  } catch (err) {
    console.warn("[sharedReadCache] gen sync failed:", err);
  }
}

function entryKey(gen: string, cacheKey: string): string {
  return `${KEY_PREFIX}${gen}:${cacheKey}`;
}

export async function readSharedGasCache(
  cacheKey: string
): Promise<{ body: string; status: number } | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    await syncSharedCacheGeneration();
    const gen = localSeenGen || (await currentGeneration(redis));
    const raw = await redis.get<SharedEntry | string>(entryKey(gen, cacheKey));
    if (!raw) return null;
    const entry: SharedEntry =
      typeof raw === "string" ? (JSON.parse(raw) as SharedEntry) : raw;
    if (!entry?.body || typeof entry.status !== "number") return null;
    if (!isSuccessfulGasReadBody(entry.body)) return null;
    return { body: entry.body, status: entry.status };
  } catch (err) {
    console.warn("[sharedReadCache] read failed:", err);
    return null;
  }
}

/** Last successful payload — survives gen bumps; emergency fallback only. */
export async function readLastGoodGasCache(
  cacheKey: string
): Promise<{ body: string; status: number } | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get<SharedEntry | string>(`${LAST_GOOD_PREFIX}${cacheKey}`);
    if (!raw) return null;
    const entry: SharedEntry =
      typeof raw === "string" ? (JSON.parse(raw) as SharedEntry) : raw;
    if (!entry?.body || typeof entry.status !== "number") return null;
    if (!isSuccessfulGasReadBody(entry.body)) return null;
    return { body: entry.body, status: entry.status };
  } catch (err) {
    console.warn("[sharedReadCache] last-good read failed:", err);
    return null;
  }
}

export async function writeSharedGasCache(
  cacheKey: string,
  body: string,
  status: number,
  ttlMs: number,
  action?: string | null
): Promise<void> {
  const redis = getRedis();
  if (!redis || ttlMs <= 0 || status !== 200) return;
  if (!isCacheableGasReadBody(action, body)) return;
  try {
    await syncSharedCacheGeneration();
    const gen = localSeenGen || (await currentGeneration(redis));
    const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
    const payload: SharedEntry = { body, status };
    await redis.set(entryKey(gen, cacheKey), payload, { ex: ttlSec });
    await redis.set(`${LAST_GOOD_PREFIX}${cacheKey}`, payload, {
      ex: LAST_GOOD_TTL_SEC,
    });
  } catch (err) {
    console.warn("[sharedReadCache] write failed:", err);
  }
}

/** Bump generation so fresh keys miss; last-good kept for timeout fallback. */
export async function invalidateSharedGasCache(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const next = await redis.incr(GEN_KEY);
    localSeenGen = String(next);
  } catch (err) {
    console.warn("[sharedReadCache] invalidate failed:", err);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Across Vercel isolates: only one caller hits GAS for a given cacheKey;
 * waiters reuse the lock-holder result (or fall through after timeout).
 */
export async function withSharedSingleflight(
  cacheKey: string,
  run: () => Promise<string>
): Promise<{ text: string; shared: boolean }> {
  const redis = getRedis();
  if (!redis) {
    return { text: await run(), shared: false };
  }

  const lockKey = `${LOCK_PREFIX}${cacheKey}`;
  const resultKey = `${LOCK_RESULT_PREFIX}${cacheKey}`;

  try {
    const acquired = await redis.set(lockKey, "1", { nx: true, ex: LOCK_TTL_SEC });
    if (acquired) {
      try {
        const text = await run();
        if (isSuccessfulGasReadBody(text)) {
          await redis.set(resultKey, text, { ex: LOCK_TTL_SEC });
        }
        return { text, shared: false };
      } finally {
        try {
          await redis.del(lockKey);
        } catch {
          /* ignore */
        }
      }
    }

    // Wait for lock holder (max ~20s) instead of stacking another GAS call.
    for (let i = 0; i < 40; i += 1) {
      await sleep(500);
      const ready = await redis.get<string>(resultKey);
      if (ready && isSuccessfulGasReadBody(ready)) {
        return { text: ready, shared: true };
      }
      const stillLocked = await redis.get(lockKey);
      if (!stillLocked) break;
    }
  } catch (err) {
    console.warn("[sharedReadCache] singleflight failed:", err);
  }

  return { text: await run(), shared: false };
}
