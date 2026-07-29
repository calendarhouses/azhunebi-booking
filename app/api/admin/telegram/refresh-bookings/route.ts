import { NextResponse } from "next/server";

import { verifyAdminRequest } from "@/lib/admin/verifyAdminRequest";
import { fetchCronTelegramDigest } from "@/lib/telegram/cronDigest";
import { isTelegramConfigured } from "@/lib/telegram/config";
import { refreshPaidBookingsTelegramMessages } from "@/lib/telegram/refreshPaidBookingsTelegramMessages";
import { type GasBookingRecord } from "@/lib/gas-api";

export const runtime = "nodejs";

type RefreshResult = {
  ok: boolean;
  edited: number;
  missingBookings: number;
};

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id")?.trim() || null;
  const auth = await verifyAdminRequest(request, tenantId);
  if (auth instanceof NextResponse) return auth;

  if (!isTelegramConfigured()) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_NOT_CONFIGURED" }, { status: 503 });
  }

  const digest = await fetchCronTelegramDigest();
  const bookings = (digest.bookings || []) as GasBookingRecord[];
  const settings = digest.settings || {};

  const { edited, missingBookings } =
    await refreshPaidBookingsTelegramMessages({ bookings, settings });

  const result: RefreshResult = {
    ok: true,
    edited,
    missingBookings,
  };

  return NextResponse.json(result);
}

