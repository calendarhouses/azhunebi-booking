import { NextResponse } from "next/server";
import { authorizeBearer, cronSecrets } from "@/lib/cron/authorize";
import { sendPendingReviewReminders } from "@/lib/telegram/pendingReviewReminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(request: Request): boolean {
  return authorizeBearer(request, cronSecrets());
}

/**
 * cron-job.org every 10 min:
 *   GET/POST /api/internal/pending-review-reminders
 *   Authorization: Bearer <CRON_SECRET | TELEGRAM_CRON_SECRET>
 *
 * Pings Telegram topic «Запити бронювання» while any booking is
 * still «Очікує підтвердження». No message when the queue is empty.
 */
async function handle(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await sendPendingReviewReminders();
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    console.error("[pending-review-reminders]", err);
    return NextResponse.json(
      {
        ok: false,
        count: 0,
        sent: false,
        error: err instanceof Error ? err.message : "REMINDER_FAILED",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
