/**
 * Simple rate limit for public booking creates.
 * Prefer Upstash Redis REST when configured; otherwise in-memory (best-effort per instance).
 */

type Bucket = { count: number; resetAt: number };

const memory = new Map<string, Bucket>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0]?.trim();
  if (first) return first;
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

async function upstashIncr(key: string, windowSec: number): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;

  try {
    // SET NX EX seeds the window; INCR counts within it.
    const pipeline = [
      ["SET", key, "0", "NX", "EX", String(windowSec)],
      ["INCR", key],
    ];
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pipeline),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{ result?: number | string | null }>;
    const count = Number(json?.[1]?.result);
    return Number.isFinite(count) ? count : null;
  } catch {
    return null;
  }
}

function memoryIncr(key: string, windowSec: number): number {
  const now = Date.now();
  const cur = memory.get(key);
  if (!cur || cur.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return 1;
  }
  cur.count += 1;
  return cur.count;
}

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
};

/** Returns ok=false when the IP exceeded `limit` creates in `windowSec`. */
export async function rateLimitPublicBooking(
  request: Request,
  opts?: { limit?: number; windowSec?: number }
): Promise<RateLimitResult> {
  const limit = opts?.limit ?? 8;
  const windowSec = opts?.windowSec ?? 60;
  const ip = clientIp(request);
  const key = `rl:public-booking:${ip}`;

  const remote = await upstashIncr(key, windowSec);
  const count = remote ?? memoryIncr(key, windowSec);
  const remaining = Math.max(0, limit - count);
  return {
    ok: count <= limit,
    limit,
    remaining,
    retryAfterSec: windowSec,
  };
}
