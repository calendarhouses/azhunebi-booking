import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin/verifyAdminRequest";
import { syncCleaningTodayTurnovers } from "@/lib/telegram/cleaningArrivalNotify";
import { fetchCronTelegramDigest } from "@/lib/telegram/cronDigest";
import type { ArrivalDepartureBooking } from "@/lib/telegram/arrivalDepartureNotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/cleaning-notify/sync
 * Оновлює сповіщення в групі ПРИБИРАННЯ (edit / delete / send).
 */
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id")?.trim() || null;
  const auth = await verifyAdminRequest(request, tenantId);
  if (auth instanceof NextResponse) return auth;

  try {
    const digest = await fetchCronTelegramDigest();
    const bookings = digest.bookings as ArrivalDepartureBooking[];
    const result = await syncCleaningTodayTurnovers(bookings);

    return NextResponse.json({
      ok: result.errors.length === 0,
      ...result,
    });
  } catch (err) {
    console.error("[cleaning-notify/sync]", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
