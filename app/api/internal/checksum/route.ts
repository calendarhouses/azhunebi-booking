import { NextResponse } from "next/server";
import { buildChecksumReport } from "@/lib/backend/handleBackendRequest";
import { hasGasConfig, hasSupabaseConfig } from "@/lib/dataSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(request: Request): boolean {
  const secret =
    process.env.MIGRATE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.TELEGRAM_CRON_SECRET?.trim() ||
    "";
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Compare / report Supabase checksums (optional ?compareGas=1).
 * GET/POST /api/internal/checksum
 */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const report = await buildChecksumReport();

    let gas: Record<string, unknown> | null = null;
    if (hasGasConfig() && new URL(request.url).searchParams.get("compareGas") === "1") {
      const email =
        process.env.ADMIN_EMAIL?.trim() ||
        process.env.GAS_ADMIN_EMAIL?.trim() ||
        "Azhunebi2026";
      const password =
        process.env.ADMIN_PASSWORD?.trim() ||
        process.env.GAS_ADMIN_PASSWORD?.trim() ||
        "azhunebi12345";
      const gasUrl = process.env.NEXT_PUBLIC_GAS_URL!.trim();
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
      const login = (await loginRes.json()) as { accessToken?: string };
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
        bookings?: unknown[];
        settings?: Record<string, unknown>;
      };
      const bookings = Array.isArray(init.bookings) ? init.bookings : [];
      let totalPriceSum = 0;
      let paidSum = 0;
      for (const b of bookings as Array<Record<string, unknown>>) {
        totalPriceSum += Number(b.totalPrice) || 0;
        paidSum += Number(b.paidAmount) || 0;
      }
      const roomsList = Array.isArray(init.settings?.roomsList)
        ? (init.settings!.roomsList as unknown[])
        : [];
      gas = {
        bookings: bookings.length,
        totalPriceSum,
        paidSum,
        rooms: roomsList.length,
        settingsKeys: init.settings ? Object.keys(init.settings).sort() : [],
      };
    }

    const sb = report.supabase as
      | {
          bookings?: { count: number; totalPriceSum: number; paidSum: number };
          rooms?: { count: number };
          settings?: { count: number; keys: string[] };
        }
      | null;

    const diff =
      gas && sb
        ? {
            bookingsCount: (gas.bookings as number) - (sb.bookings?.count ?? 0),
            totalPriceSum:
              (gas.totalPriceSum as number) - (sb.bookings?.totalPriceSum ?? 0),
            paidSum: (gas.paidSum as number) - (sb.bookings?.paidSum ?? 0),
            roomsCount: (gas.rooms as number) - (sb.rooms?.count ?? 0),
          }
        : null;

    return NextResponse.json({
      ...report,
      gas,
      diff,
      hasSupabase: hasSupabaseConfig(),
      hasGas: hasGasConfig(),
    });
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
