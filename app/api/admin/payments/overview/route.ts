import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin/verifyAdminRequest";
import { buildPaymentOverview } from "@/lib/payment/paymentOverview";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Live health + feed + awaiting pay-links for the Оплата settings panel. */
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id")?.trim() || null;
  const auth = await verifyAdminRequest(request, tenantId);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const probe = url.searchParams.get("probe") !== "0";

  try {
    const overview = await buildPaymentOverview({ probeToken: probe });
    return NextResponse.json(
      { ok: true, ...overview },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[admin/payments/overview]", err);
    return NextResponse.json(
      {
        ok: false,
        error: "OVERVIEW_FAILED",
        message: err instanceof Error ? err.message : "Не вдалося завантажити огляд оплат",
      },
      { status: 502 }
    );
  }
}
