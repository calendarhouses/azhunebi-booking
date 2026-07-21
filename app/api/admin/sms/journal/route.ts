import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin/verifyAdminRequest";
import { gasFetch } from "@/lib/gas-api";
import { extractBearerToken } from "@/lib/admin/adminDbClient";
import { normalizeSmsSettings, type SmsSettings } from "@/lib/sms/smsSettings";
import { fetchTurboSmsMessageDetails } from "@/lib/sms/turbosms";
import { mergeSmsJournal } from "@/lib/sms/persistSmsJournal";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id")?.trim() || null;
  const auth = await verifyAdminRequest(request, tenantId);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const refreshStatuses = url.searchParams.get("refresh") === "true";

  // Load smsSettings from GAS (which holds the journal)
  let smsSettings: SmsSettings;
  try {
    const data = await gasFetch<{ smsSettings?: unknown }>(
      { action: "settings", tenant_id: tenantId || undefined },
      { authToken: extractBearerToken(request) },
    );
    smsSettings = normalizeSmsSettings(data.smsSettings);
  } catch {
    smsSettings = normalizeSmsSettings(undefined);
  }

  let journal = smsSettings.journal;

  if (refreshStatuses && journal.length > 0) {
    const messageIds = journal
      .map((e) => e.messageId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    if (messageIds.length > 0) {
      const detailsResult = await fetchTurboSmsMessageDetails(messageIds);
      if (detailsResult.ok && detailsResult.details) {
        const statusMap = new Map(
          detailsResult.details.map((d) => [d.message_id, d]),
        );
        journal = journal.map((entry) => {
          if (!entry.messageId) return entry;
          const detail = statusMap.get(entry.messageId);
          if (!detail) return entry;
          return {
            ...entry,
            deliveryStatus: detail.status,
            deliveryTime: detail.status_time,
          };
        });
      }
    }
  }

  return NextResponse.json({ ok: true, journal });
}
