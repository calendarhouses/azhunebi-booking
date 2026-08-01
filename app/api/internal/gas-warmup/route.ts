import { NextResponse } from "next/server";
import { fetchInitData, fetchPublicTenantData, gasPost } from "@/lib/gas-api";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * Keeps Apps Script warm and fills public + admin script caches so the first
 * real visitor/admin does not pay a cold-start tax.
 */
export async function GET(request: Request) {
  const secret =
    process.env.CRON_SECRET?.trim() ||
    process.env.TELEGRAM_CRON_SECRET?.trim() ||
    "";
  const auth = request.headers.get("authorization") || "";
  const isVercelCron =
    Boolean(request.headers.get("x-vercel-cron-auth-token")) ||
    (request.headers.get("user-agent") || "").includes("vercel-cron");
  const isBearer = Boolean(secret) && auth === `Bearer ${secret}`;
  if (!isVercelCron && !isBearer) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const tenantId =
    new URL(request.url).searchParams.get("tenant_id")?.trim() || "default";

  const started = Date.now();
  const results: Record<string, string | number> = {};

  try {
    await fetchPublicTenantData(tenantId);
    results.tenant = "ok";
  } catch (err) {
    results.tenant = err instanceof Error ? err.message : String(err);
  }

  const webhookSecret =
    process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
    process.env.REVIEW_WEBHOOK_SECRET?.trim() ||
    "";

  if (webhookSecret) {
    try {
      const warm = await gasPost<{
        ok?: boolean;
        publicBookings?: number;
        adminBookings?: number;
        error?: string;
      }>({
        action: "warmInitCaches",
        tenant_id: tenantId,
        webhookSecret,
      });
      if (warm.error) {
        results.warmCaches = warm.error;
      } else {
        results.warmCaches = "ok";
        results.publicBookings = warm.publicBookings ?? 0;
        results.adminBookings = warm.adminBookings ?? 0;
      }
    } catch (err) {
      results.warmCaches = err instanceof Error ? err.message : String(err);
      // Fallback: at least warm the public path
      try {
        await fetchInitData(tenantId);
        results.availability = "ok";
      } catch (err2) {
        results.availability = err2 instanceof Error ? err2.message : String(err2);
      }
    }
  } else {
    try {
      await fetchInitData(tenantId);
      results.availability = "ok";
    } catch (err) {
      results.availability = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json({
    ok: results.tenant === "ok" && (results.warmCaches === "ok" || results.availability === "ok"),
    tenantId,
    ms: Date.now() - started,
    results,
  });
}
