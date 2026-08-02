import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin/verifyAdminRequest";
import { fetchCronTelegramDigest } from "@/lib/telegram/cronDigest";
import { isTelegramConfigured } from "@/lib/telegram/config";
import type { ArrivalDepartureBooking } from "@/lib/telegram/arrivalDepartureNotify";
import { refreshTurnoversTelegramMessages } from "@/lib/telegram/refreshTurnoversTelegramMessages";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Manual "Оновити сповіщення" from the chessboard.
 *
 * Prefer bookings (+ telegramTurnoversState) from the admin client — those are
 * what the user just edited. Re-fetching a full GAS digest is slow and often
 * returns pre-save cottage/guests, so Telegram looks "stuck".
 */
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id")?.trim() || null;
  const auth = await verifyAdminRequest(request, tenantId);
  if (auth instanceof NextResponse) return auth;

  if (!isTelegramConfigured()) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_NOT_CONFIGURED" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    bookings?: ArrivalDepartureBooking[];
    settings?: Record<string, unknown>;
  };

  const clientBookings = Array.isArray(body.bookings) ? body.bookings : null;
  const clientSettings =
    body.settings && typeof body.settings === "object" ? body.settings : null;
  const clientHasTurnoversState =
    Boolean(clientSettings) &&
    Object.prototype.hasOwnProperty.call(clientSettings, "telegramTurnoversState");

  let bookings = clientBookings;
  let settings = clientSettings || {};

  // Need message_id map and/or bookings — fall back to digest only for missing parts.
  if (!bookings || !clientHasTurnoversState) {
    try {
      const digest = await fetchCronTelegramDigest();
      if (!bookings) bookings = (digest.bookings || []) as ArrivalDepartureBooking[];
      if (!clientHasTurnoversState) {
        settings = {
          ...settings,
          telegramTurnoversState: digest.settings?.telegramTurnoversState,
        };
      }
    } catch (err) {
      if (!bookings) {
        return NextResponse.json(
          {
            ok: false,
            error: err instanceof Error ? err.message : "Не вдалося завантажити дані для Telegram",
          },
          { status: 502 }
        );
      }
      // Have client bookings but no state — refresh can still send new messages.
    }
  }

  const result = await refreshTurnoversTelegramMessages({
    bookings: bookings || [],
    settings,
    // Manual button: edit existing + send missing (e.g. after cottage move).
    editOnly: false,
  });

  return NextResponse.json({
    ok: true,
    edited: result.edited,
    sent: result.sent,
    skipped: result.skipped,
    updatedDay: result.updatedDay,
    telegramTurnoversState: result.telegramTurnoversState,
  });
}
