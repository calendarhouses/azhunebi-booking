import { NextResponse } from "next/server";
import { touchKeepAlive } from "@/lib/db/settings";
import { hasSupabaseConfig } from "@/lib/dataSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: Request): boolean {
  const secret =
    process.env.CRON_SECRET?.trim() ||
    process.env.TELEGRAM_CRON_SECRET?.trim() ||
    "";
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Prevents Supabase Free project pause — touch a settings row. */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ ok: false, error: "NO_SUPABASE" }, { status: 500 });
  }
  try {
    const at = await touchKeepAlive();
    return NextResponse.json({ ok: true, at });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
