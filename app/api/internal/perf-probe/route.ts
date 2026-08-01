import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Smoke probe for boot latency before/after deploys.
 * GET /api/internal/perf-probe?secret=...
 *
 * Measures direct GAS initData + adminInitData (cold-ish sequential + burst).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret") || "";
  const expected =
    process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
    process.env.PERF_PROBE_SECRET?.trim() ||
    "";
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const gasUrl = process.env.NEXT_PUBLIC_GAS_URL?.trim();
  if (!gasUrl) {
    return NextResponse.json({ error: "NO_GAS_URL" }, { status: 500 });
  }

  const token = process.env.GAS_ADMIN_TOKEN?.trim() || "";

  async function timed(action: string, withToken: boolean) {
    const target = new URL(gasUrl!);
    target.searchParams.set("action", action);
    target.searchParams.set("t", String(Date.now()));
    if (withToken && token) target.searchParams.set("token", token);
    const t0 = Date.now();
    const res = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
    });
    const text = await res.text();
    const ms = Date.now() - t0;
    let bookings = 0;
    let ok = false;
    try {
      const json = JSON.parse(text) as { bookings?: unknown[]; error?: string };
      ok = !json.error && res.ok;
      bookings = Array.isArray(json.bookings) ? json.bookings.length : 0;
    } catch {
      ok = false;
    }
    return { action, ms, ok, bytes: text.length, bookings, status: res.status };
  }

  const sequential: Awaited<ReturnType<typeof timed>>[] = [];
  sequential.push(await timed("initData", false));
  sequential.push(await timed("initData", false));
  if (token) {
    sequential.push(await timed("adminInitData", true));
  }

  const burst = await Promise.all([
    timed("initData", false),
    timed("initData", false),
    timed("initData", false),
  ]);

  return NextResponse.json({
    at: new Date().toISOString(),
    sequential,
    burst,
    thresholds: {
      warmInitMs: 5000,
      coldInitMs: 8000,
      burstP95Ms: 8000,
    },
  });
}
