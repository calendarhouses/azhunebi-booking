import { NextResponse } from "next/server";
import { authorizeBearer, cronSecrets } from "@/lib/cron/authorize";
import { syncAllIcalImports } from "@/lib/ical/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(request: Request): boolean {
  return authorizeBearer(request, cronSecrets());
}

async function handle(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const { results, settings } = await syncAllIcalImports();
    const connected = results.filter((r) =>
      settings.rooms.some((s) => s.roomId === r.roomId && s.importUrl)
    );
    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      rooms: results,
      connected: connected.length,
      errors: results.filter((r) => r.error).length,
    });
  } catch (err) {
    console.error("[ical-sync]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "SYNC_FAILED" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
