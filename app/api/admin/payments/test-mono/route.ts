import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin/verifyAdminRequest";
import { getMonoMerchantDetails, MonoApiError } from "@/lib/monopay/client";
import { resolveMonoAcquiringTokenServer } from "@/lib/payment/loadPaymentSettings";

export const runtime = "nodejs";
export const maxDuration = 20;

/**
 * POST /api/admin/payments/test-mono
 * Body: { token?: string } — optional draft token; else uses settings/env.
 */
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id")?.trim() || null;
  const auth = await verifyAdminRequest(request, tenantId);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { token?: unknown };
  const draft =
    typeof body.token === "string" && body.token.trim() ? body.token.trim() : "";

  try {
    const token = draft || (await resolveMonoAcquiringTokenServer());
    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: "TOKEN_MISSING",
          message: "API-ключ Mono не задано",
        },
        { status: 400 }
      );
    }
    const details = await getMonoMerchantDetails(token);
    return NextResponse.json({
      ok: true,
      merchantId: details.merchantId || null,
      merchantName: details.merchantName || null,
      edrpou: details.edrpou || null,
    });
  } catch (err) {
    const message =
      err instanceof MonoApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Не вдалося перевірити ключ Mono";
    const status = err instanceof MonoApiError && err.status === 403 ? 403 : 502;
    return NextResponse.json(
      { ok: false, error: "MONO_CHECK_FAILED", message },
      { status }
    );
  }
}
