import { NextResponse } from "next/server";

import { verifyAdminRequest } from "@/lib/admin/verifyAdminRequest";
import { fetchCronTelegramDigest } from "@/lib/telegram/cronDigest";
import { isTelegramConfigured } from "@/lib/telegram/config";
import { refreshPaidBookingsTelegramMessages } from "@/lib/telegram/refreshPaidBookingsTelegramMessages";
import { type GasBookingRecord } from "@/lib/gas-api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id")?.trim() || null;
  const auth = await verifyAdminRequest(request, tenantId);
  if (auth instanceof NextResponse) return auth;

  if (!isTelegramConfigured()) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_NOT_CONFIGURED" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    bookings?: GasBookingRecord[];
    settings?: Record<string, unknown>;
  };

  const clientBookings = Array.isArray(body.bookings) ? body.bookings : null;
  const clientSettings =
    body.settings && typeof body.settings === "object" ? body.settings : null;
  const clientHasBookingsState =
    Boolean(clientSettings) &&
    Object.prototype.hasOwnProperty.call(clientSettings, "telegramBookingsState");

  let bookings = clientBookings;
  let settings = clientSettings || {};

  if (!bookings || !clientHasBookingsState) {
    try {
      const digest = await fetchCronTelegramDigest();
      if (!bookings) bookings = (digest.bookings || []) as GasBookingRecord[];
      if (!clientHasBookingsState) {
        settings = {
          ...settings,
          telegramBookingsState: digest.settings?.telegramBookingsState,
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
    }
  }

  const { edited, missingBookings } = await refreshPaidBookingsTelegramMessages({
    bookings: bookings || [],
    settings,
  });

  return NextResponse.json({
    ok: true,
    edited,
    missingBookings,
  });
}
