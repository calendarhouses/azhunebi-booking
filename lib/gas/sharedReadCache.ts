/**
 * Cross-instance GAS read cache via Upstash Redis.
 * Without UPSTASH_REDIS_REST_URL/TOKEN this is a no-op (local Map only).
 *
 * Invalidation bumps a generation counter so old TTL keys are ignored
 * without SCAN/KEYS (safe on Upstash free).
 */

import { Redis } from "@upstash/redis";
import {
  bumpGasCacheGeneration,
  isSuccessfulGasReadBody,
} from "@/lib/gas/inflightCoalesce";

const GEN_KEY = "gas:read:gen";
const KEY_PREFIX = "gas:read:";

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

export async function writeSharedGasCache(
  cacheKey: string,
  body: string,
  status: number,
  ttlMs: number
): Promise<void> {
  const redis = getRedis();
  if (!redis || ttlMs <= 0 || status !== 200) return;
  if (!isSuccessfulGasReadBody(body)) return;
  try {
    await syncSharedCacheGeneration();
    const gen = localSeenGen || (await currentGeneration(redis));
    const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
    const payload: SharedEntry = { body, status };
    await redis.set(entryKey(gen, cacheKey), payload, { ex: ttlSec });
  } catch (err) {
    console.warn("[sharedReadCache] write failed:", err);
  }
}

/** Bump generation so all prior shared entries miss until they TTL out. */
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
