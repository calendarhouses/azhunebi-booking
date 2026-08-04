import { NextResponse } from "next/server";
import { authorizeBearer, migrateSecrets } from "@/lib/cron/authorize";
import { isDualWriteSupabase, hasGasConfig, hasSupabaseConfig } from "@/lib/dataSource";
import { hydrateGuestProfilesFromSettings } from "@/lib/db/guestProfiles";
import { upsertBooking } from "@/lib/db/bookings";
import { saveSettingsMerge } from "@/lib/db/settings";
import { syncRoomsList } from "@/lib/db/rooms";
import type { ApiBooking, ApiRoom } from "@/lib/db/mappers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(request: Request): boolean {
  return authorizeBearer(request, migrateSecrets());
}

/**
 * Heal Supabase from a fresh GAS snapshot (dual-write safety net).
 * POST /api/internal/reconcile
 */
export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ ok: false, error: "NO_SUPABASE" }, { status: 500 });
  }
  if (!hasGasConfig()) {
    return NextResponse.json({ ok: false, error: "NO_GAS" }, { status: 500 });
  }

  // After cutover (supabase primary) do not pull GAS over live DB.
  const { getDataSource } = await import("@/lib/dataSource");
  if (getDataSource() === "supabase") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "DATA_SOURCE=supabase — reconcile is GAS→Supabase only",
    });
  }

  try {
    const gasUrl = process.env.NEXT_PUBLIC_GAS_URL!.trim();
    const email =
      process.env.ADMIN_EMAIL?.trim() ||
      process.env.GAS_ADMIN_EMAIL?.trim() ||
      "Azhunebi2026";
    const password =
      process.env.ADMIN_PASSWORD?.trim() ||
      process.env.GAS_ADMIN_PASSWORD?.trim() ||
      "azhunebi12345";

    const loginRes = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "login",
        email: email.trim().toLowerCase(),
        password,
      }),
      cache: "no-store",
    });
    const login = (await loginRes.json()) as { accessToken?: string; error?: string };
    if (!login.accessToken) {
      throw new Error(login.error || "GAS login failed");
    }

    const initRes = await fetch(gasUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
        Authorization: `Bearer ${login.accessToken}`,
      },
      body: JSON.stringify({
        action: "adminInitData",
        tenant_id: "default",
        accessToken: login.accessToken,
      }),
      cache: "no-store",
    });
    const init = (await initRes.json()) as {
      bookings?: ApiBooking[];
      settings?: Record<string, unknown>;
      error?: string;
    };
    if (init.error) throw new Error(init.error);

    const bookings = Array.isArray(init.bookings) ? init.bookings : [];
    const settings = init.settings && typeof init.settings === "object" ? init.settings : {};
    const roomsList = Array.isArray(settings.roomsList)
      ? (settings.roomsList as ApiRoom[])
      : [];

    let bookingsUpserted = 0;
    for (const b of bookings) {
      if (!b?.id) continue;
      await upsertBooking(b);
      bookingsUpserted += 1;
    }

    const roomsUpserted = await syncRoomsList(roomsList);
    await saveSettingsMerge(settings);
    const guestsHydrated = await hydrateGuestProfilesFromSettings();

    return NextResponse.json({
      ok: true,
      dualWriteEnabled: isDualWriteSupabase(),
      upserted: {
        bookings: bookingsUpserted,
        rooms: roomsUpserted,
        settingsKeys: Object.keys(settings).length,
        guestProfilesHydrated: guestsHydrated,
      },
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[reconcile]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
