import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin/verifyAdminRequest";
import { fetchTurboSmsBalance } from "@/lib/sms/turbosms";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id")?.trim() || null;
  const auth = await verifyAdminRequest(request, tenantId);
  if (auth instanceof NextResponse) return auth;

  const result = await fetchTurboSmsBalance();
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error || "balance_unavailable" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, balance: result.balance });
}
