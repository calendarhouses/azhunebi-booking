import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { fetchInitData } from "@/lib/gas-api";
import type { AdminInitResponse } from "@/components/admin/desktop/types";

export const runtime = "nodejs";

/** CDN + Data Cache: 5 minutes (bots/repeat visits share one Function Invocation). */
const REVALIDATE_SECONDS = 300;

const CDN_CACHE =
  "public, s-maxage=300, stale-while-revalidate=60";

async function loadPublicInit(tenantId: string): Promise<AdminInitResponse> {
  return fetchInitData(tenantId);
}

function getCachedPublicInit(tenantId: string): Promise<AdminInitResponse> {
  return unstable_cache(
    () => loadPublicInit(tenantId),
    ["public-init-v1", tenantId],
    { revalidate: REVALIDATE_SECONDS }
  )();
}

/**
 * Public catalog bootstrap (rooms + bookings + settings).
 * Cached aggressively so crawlers do not burn Function Invocations.
 * Pass ?fresh=1 after overbooking / mutation to bypass caches.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = (url.searchParams.get("tenant_id") || "default").trim() || "default";
  const fresh = url.searchParams.get("fresh") === "1";

  try {
    const body = fresh
      ? await loadPublicInit(tenantId)
      : await getCachedPublicInit(tenantId);

    return NextResponse.json(body, {
      status: 200,
      headers: {
        "Cache-Control": fresh ? "private, no-store" : CDN_CACHE,
      },
    });
  } catch (err) {
    console.error("[public/init]", err);
    return NextResponse.json(
      {
        error: "INIT_FAILED",
        message: err instanceof Error ? err.message : "Failed to load initData",
      },
      {
        status: 502,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  }
}
