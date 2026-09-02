import { NextResponse } from "next/server";
import { authorizeBearer, cronSecrets } from "@/lib/cron/authorize";
import { notifyTodayArrivalsAndDepartures } from "@/lib/telegram/arrivalDepartureNotify";
import { notifyCleaningTodayTurnovers } from "@/lib/telegram/cleaningArrivalNotify";
import { fetchCronTelegramDigest } from "@/lib/telegram/cronDigest";
import { buildFinancePeriodStats } from "@/lib/telegram/financeDigestStats";
import {
  sendDebtReminders,
  sendEveningCashSummary,
  sendFinancePeriodSummary,
} from "@/lib/telegram/financeNotify";
import type { BookingRecord } from "@/components/admin/desktop/types";
import { toDateKeyKyiv } from "@/lib/telegram/formatters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(request: Request): boolean {
  return authorizeBearer(request, cronSecrets());
}

function kyivParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
  );
  return {
    yyyyMmDd: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: parts.weekday, // Mon, Tue, ...
    day: Number(parts.day),
    month: Number(parts.month),
    year: Number(parts.year),
  };
}

function lastDayOfMonthKyiv(): boolean {
  const now = kyivParts();
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  // compare via formatting +1 calendar day in Kyiv is awkward; use Date in Kyiv noon
  const noon = new Date(`${now.yyyyMmDd}T12:00:00+03:00`);
  const next = new Date(noon.getTime() + 86_400_000);
  const nextParts = kyivParts(next);
  return nextParts.day === 1;
}

function weekRangeKyiv(): { start: string; end: string; label: string } {
  const now = kyivParts();
  const noon = new Date(`${now.yyyyMmDd}T12:00:00+03:00`);
  // weekday: Mon=1 ... Sun=0 in JS getDay — use en-CA weekday
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  const iso = map[now.weekday] || 1;
  const start = new Date(noon.getTime() - (iso - 1) * 86_400_000);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const startKey = toDateKeyKyiv(start);
  const endKey = toDateKeyKyiv(end);
  return {
    start: startKey,
    end: endKey,
    label: `${startKey} — ${endKey}`,
  };
}

function monthRangeKyiv(): { start: string; end: string; label: string } {
  const now = kyivParts();
  const start = `${now.year}-${String(now.month).padStart(2, "0")}-01`;
  const last = lastDayOfMonthKyiv()
    ? now.yyyyMmDd
    : (() => {
        const noon = new Date(`${now.year}-${String(now.month).padStart(2, "0")}-15T12:00:00+03:00`);
        const nextMonth = new Date(noon);
        nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
        const lastDay = new Date(nextMonth.getTime() - 86_400_000);
        return toDateKeyKyiv(lastDay);
      })();
  const months = [
    "січень", "лютий", "березень", "квітень", "травень", "червень",
    "липень", "серпень", "вересень", "жовтень", "листопад", "грудень",
  ];
  return {
    start,
    end: lastDayOfMonthKyiv() ? now.yyyyMmDd : last,
    label: `${months[now.month - 1]} ${now.year}`,
  };
}

async function runJobs(force?: string | null) {
  const digest = await fetchCronTelegramDigest();
  const bookings = digest.bookings;
  const settings = digest.settings;
  const results: Record<string, unknown> = {};
  const now = kyivParts();

  if (!force || force === "arrivals") {
    const arrivalBookings =
      bookings as Parameters<typeof notifyTodayArrivalsAndDepartures>[0];
    results.arrivals = await notifyTodayArrivalsAndDepartures(arrivalBookings);
    results.cleaningTurnovers = await notifyCleaningTodayTurnovers(arrivalBookings);
  }
  // Explicit cleaning-only job (maids chat). Arrivals already includes cleaning.
  if (force === "cleaning") {
    const arrivalBookings =
      bookings as Parameters<typeof notifyCleaningTodayTurnovers>[0];
    results.cleaningTurnovers = await notifyCleaningTodayTurnovers(arrivalBookings);
  }
  if (!force || force === "debt") {
    results.debt = await sendDebtReminders(
      bookings as Parameters<typeof sendDebtReminders>[0]
    );
  }
  if (force === "evening") {
    results.evening = await sendEveningCashSummary(
      bookings as Parameters<typeof sendEveningCashSummary>[0]
    );
  }

  if (force === "weekly" || (!force && now.weekday === "Sun")) {
    const range = weekRangeKyiv();
    const stats = buildFinancePeriodStats(
      bookings as BookingRecord[],
      (settings.transactions as Array<Record<string, unknown>>) || [],
      range.start,
      range.end
    );
    results.weekly = await sendFinancePeriodSummary({
      titleEmoji: "📊",
      title: "ТИЖНЕВЕ ЗВЕДЕННЯ",
      periodLabel: range.label,
      stats,
    });
  }
  if ((force === "monthly" || !force) && lastDayOfMonthKyiv()) {
    const range = monthRangeKyiv();
    const stats = buildFinancePeriodStats(
      bookings as BookingRecord[],
      (settings.transactions as Array<Record<string, unknown>>) || [],
      range.start,
      range.end
    );
    results.monthly = await sendFinancePeriodSummary({
      titleEmoji: "📆",
      title: "МІСЯЧНЕ ЗВЕДЕННЯ",
      periodLabel: range.label,
      stats,
    });
  }

  return results;
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const url = new URL(request.url);
  const force = url.searchParams.get("force");
  try {
    if (force === "demo" || force === "preview" || force === "all") {
      const { sendTelegramDemoAllThreads } = await import("@/lib/telegram/demoAllThreads");
      const results = await sendTelegramDemoAllThreads();
      return NextResponse.json({ ok: true, mode: "demo", results });
    }
    const results = await runJobs(force);
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[TG cron]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
