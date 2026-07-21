import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin/verifyAdminRequest";
import { gasFetch } from "@/lib/gas-api";
import { extractBearerToken } from "@/lib/admin/adminDbClient";
import {
  normalizeSmsSettings,
  type SmsJournalEntry,
  type SmsSettings,
} from "@/lib/sms/smsSettings";
import { fetchTurboSmsMessageDetails } from "@/lib/sms/turbosms";
import { isSmsDeliveryFinal } from "@/lib/sms/smsDeliveryStatus";
import { persistSmsJournalBulk } from "@/lib/sms/persistSmsJournal";

export const runtime = "nodejs";

function enrichJournalWithDetails(
  journal: SmsJournalEntry[],
  details: Awaited<ReturnType<typeof fetchTurboSmsMessageDetails>>["details"],
): { journal: SmsJournalEntry[]; changed: boolean } {
  if (!details?.length) return { journal, changed: false };

  const statusMap = new Map(details.map((d) => [d.message_id, d]));
  let changed = false;

  const next = journal.map((entry) => {
    if (!entry.messageId) return entry;
    const detail = statusMap.get(entry.messageId);
    if (!detail) return entry;

    const patch: Partial<SmsJournalEntry> = {};
    if (detail.status && detail.status !== entry.deliveryStatus) {
      patch.deliveryStatus = detail.status;
      changed = true;
    }
    if (detail.status_time && detail.status_time !== entry.deliveryTime) {
      patch.deliveryTime = detail.status_time;
      changed = true;
    }
    if (detail.cost != null && detail.cost !== entry.costEstimate) {
      patch.costEstimate = detail.cost;
      changed = true;
    }
    if (detail.parts != null && detail.parts !== entry.segments) {
      patch.segments = detail.parts;
      changed = true;
    }

    return Object.keys(patch).length ? { ...entry, ...patch } : entry;
  });

  return { journal: next, changed };
}

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id")?.trim() || null;
  const auth = await verifyAdminRequest(request, tenantId);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const refreshStatuses = url.searchParams.get("refresh") === "true";
  const authToken = extractBearerToken(request);

  let smsSettings: SmsSettings;
  try {
    const data = await gasFetch<{ smsSettings?: unknown }>(
      { action: "settings", tenant_id: tenantId || undefined },
      { authToken },
    );
    smsSettings = normalizeSmsSettings(data.smsSettings);
  } catch {
    smsSettings = normalizeSmsSettings(undefined);
  }

  let journal = smsSettings.journal;
  let statusesRefreshed = false;

  if (refreshStatuses && journal.length > 0) {
    const messageIds = journal
      .map((e) => e.messageId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    if (messageIds.length > 0) {
      const detailsResult = await fetchTurboSmsMessageDetails(messageIds);
      if (detailsResult.ok && detailsResult.details) {
        const enriched = enrichJournalWithDetails(journal, detailsResult.details);
        journal = enriched.journal;
        statusesRefreshed = enriched.changed;

        if (enriched.changed) {
          const saved = await persistSmsJournalBulk(journal, { authToken, tenantId }, smsSettings);
          if (saved.ok) journal = saved.journal;
        }
      }
    }
  }

  const pendingCount = journal.filter(
    (e) => e.ok && e.messageId && !isSmsDeliveryFinal(e.deliveryStatus),
  ).length;

  return NextResponse.json({ ok: true, journal, pendingCount, statusesRefreshed });
}

export async function DELETE(request: Request) {
  const tenantId = request.headers.get("x-tenant-id")?.trim() || null;
  const auth = await verifyAdminRequest(request, tenantId);
  if (auth instanceof NextResponse) return auth;

  const authToken = extractBearerToken(request);
  const saved = await persistSmsJournalBulk([], { authToken, tenantId });
  if (!saved.ok) {
    return NextResponse.json(
      { ok: false, error: saved.error || "Не вдалося очистити журнал" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, journal: [] as SmsJournalEntry[] });
}
