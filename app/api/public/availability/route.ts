import { NextResponse } from "next/server";
import { fetchInitData } from "@/lib/gas-api";
import type { AdminInitResponse } from "@/components/admin/desktop/types";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** In-flight only — visitors arriving together share one live GAS call. */
const inflight = new Map<string, Promise<AdminInitResponse>>();

export async function GET(request: Request) {
  const tenantId =
    new URL(request.url).searchParams.get("tenant_id")?.trim() || "";
  if (!tenantId) {
    return NextResponse.json(
      { error: "MISSING_TENANT", message: "tenant_id is required" },
      { status: 400 }
    );
  }

  try {
    let pending = inflight.get(tenantId);
    if (!pending) {
      pending = fetchInitData(tenantId).finally(() => {
        inflight.delete(tenantId);
      });
      inflight.set(tenantId, pending);
    }
    const data = await pending;
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "GAS_UNREACHABLE", message },
      { status: 504 }
    );
  }
}
