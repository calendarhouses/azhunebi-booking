import { NextResponse } from "next/server";
import { loadPublicBoot } from "@/lib/public-booking/loadPublicBoot";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Canonical public boot — one GAS initData (coalesced via upstream when proxied).
 * GET /api/public/init?tenant_id=default
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenant_id") || "default";
  const boot = await loadPublicBoot(tenantId);
  if (!boot) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Не вдалося завантажити дані" },
      { status: 404 }
    );
  }
  return NextResponse.json(
    {
      tenant: boot.tenant,
      settings: boot.init.settings,
      bookings: boot.init.bookings,
    },
    {
      headers: {
        // Short shared cache — many tabs must not each wait on a full GAS dump.
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    }
  );
}
