import { NextResponse } from "next/server";
import { getCachedPublicInitData } from "@/lib/public-booking/publicDataCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Public rooms/bookings snapshot for the booking site.
 * Cached server-side so visitors don't each pay the GAS round-trip.
 */
export async function GET(request: Request) {
  const tenantId =
    new URL(request.url).searchParams.get("tenant_id")?.trim() || "default";

  try {
    const data = await getCachedPublicInitData(tenantId);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=20, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("[public/init]", err);
    return NextResponse.json(
      { error: "INIT_UNAVAILABLE", message: String(err) },
      { status: 502 }
    );
  }
}
