import { NextResponse } from "next/server";
import { processBookingReview } from "@/lib/admin/processBookingReview";
import { extractBearerToken } from "@/lib/admin/adminDbClient";
import { verifyAdminRequest } from "@/lib/admin/verifyAdminRequest";
import type { GuestMessengerBooking } from "@/lib/admin/guestMessengerLinks";
import { isValidReviewSecret } from "@/lib/telegram/reviewSecret";

export const runtime = "nodejs";

function renderApprovedPage(
  orderId: string,
  booking: GuestMessengerBooking,
  smsLine: string
): string {
  const phone = String(booking.phone || "—");
  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Бронь прийнято</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 24px; color: #111827; }
    .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 8px 30px rgba(0,0,0,.08); }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { color: #6b7280; line-height: 1.5; }
    .ok { color: #059669; font-weight: 600; }
    .warn { color: #b45309; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Бронь прийнято</h1>
    <p><strong>${orderId}</strong></p>
    <p>${booking.name || "Гість"} · ${phone}</p>
    <p>${booking.cottage || "Котедж"}</p>
    <p class="${smsLine.includes("надіслано") ? "ok" : "warn"}">${smsLine}</p>
  </div>
</body>
</html>`;
}

async function runReview(decision: "approve" | "reject", orderId: string) {
  return processBookingReview({ orderId, decision });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const decision = url.searchParams.get("decision");
  const orderId = url.searchParams.get("orderId")?.trim() || "";
  const key = url.searchParams.get("key");

  if (!isValidReviewSecret(key)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!orderId || (decision !== "approve" && decision !== "reject")) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const result = await runReview(decision, orderId);

  if (!result.ok) {
    return new NextResponse(result.reason === "not_found" ? "Бронь не знайдено" : "Помилка", {
      status: result.reason === "not_found" ? 404 : 500,
    });
  }

  if (decision === "reject") {
    return new NextResponse(
      `<!DOCTYPE html><html lang="uk"><body style="font-family:sans-serif;padding:24px"><h1>Бронь скасовано</h1><p>Заявку ${orderId} відхилено.</p></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const booking = result.booking;
  if (!booking) {
    return new NextResponse("Бронь підтверджено, але дані не завантажились", { status: 500 });
  }

  const smsLine = result.smsLine || "SMS не надіслано";
  const html = renderApprovedPage(orderId, booking, smsLine);

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id")?.trim() || null;
  const auth = await verifyAdminRequest(request, tenantId);
  if (auth instanceof NextResponse) return auth;

  let body: { orderId?: string; decision?: string };
  try {
    body = (await request.json()) as { orderId?: string; decision?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const orderId = String(body.orderId || "").trim();
  const decision = body.decision;
  if (!orderId || (decision !== "approve" && decision !== "reject")) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const result = await processBookingReview({
    orderId,
    decision,
    adminAuth: {
      token: extractBearerToken(request) || "",
      tenantId: tenantId || "",
    },
  });
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 500;
    return NextResponse.json({ ok: false, reason: result.reason }, { status });
  }

  return NextResponse.json({
    ok: true,
    orderId,
    decision,
    smsLine: result.smsLine,
  });
}
