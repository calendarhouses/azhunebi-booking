import "server-only";

import { fetchCronTelegramDigest } from "@/lib/telegram/cronDigest";
import { notifyBookingComSync } from "@/lib/telegram/bookingComNotify";
import { parseICal } from "./parse";
import {
  ICAL_UID_SUFFIX,
  type IcalEvent,
  type IcalSyncSettings,
} from "./types";
import { normalizeIcalSyncSettings } from "./settings";

export type IcalRoomSyncResult = {
  roomId: number;
  cottage: string;
  fetched: number;
  created: number;
  updated: number;
  cancelled: number;
  skipped: number;
  error?: string;
};

function webhookSecret(): string {
  const secret =
    process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    "";
  if (!secret) throw new Error("TELEGRAM_REVIEW_WEBHOOK_SECRET is not set");
  return secret;
}

async function gasPostJson<T>(body: Record<string, unknown>): Promise<T> {
  const { gasPost } = await import("@/lib/gas-api");
  const json = await gasPost<T & { error?: string }>({
    ...body,
    webhookSecret: webhookSecret(),
  });
  if ((json as { error?: string }).error) {
    throw new Error((json as { error?: string }).error || "backend request failed");
  }
  return json as T;
}

export async function fetchExternalIcalEvents(url: string): Promise<IcalEvent[]> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "text/calendar, text/plain, */*",
      "User-Agent": "Khata-iCal-Sync/1.0",
    },
  });
  if (!res.ok) {
    throw new Error(`iCal fetch failed (${res.status})`);
  }
  const text = await res.text();
  return parseICal(text).filter((ev) => {
    if (!ev.uid || !ev.start || !ev.end) return false;
    // Не імпортуємо назад наші ж події.
    if (ev.uid.includes(ICAL_UID_SUFFIX)) return false;
    return ev.start < ev.end;
  });
}

type RoomLike = { id: number | string; name?: string; short?: string };

export async function syncAllIcalImports(): Promise<{
  results: IcalRoomSyncResult[];
  settings: IcalSyncSettings;
}> {
  const digest = await fetchCronTelegramDigest();
  const roomsList = Array.isArray(digest.settings.roomsList)
    ? (digest.settings.roomsList as RoomLike[])
    : [];
  const roomIds = roomsList.map((r) => r.id);
  const settings = normalizeIcalSyncSettings(digest.settings.icalSyncSettings, roomIds);

  const results: IcalRoomSyncResult[] = [];
  const nextRooms = settings.rooms.map((r) => ({ ...r }));

  for (let i = 0; i < nextRooms.length; i++) {
    const row = nextRooms[i];
    const room = roomsList.find((r) => String(r.id) === String(row.roomId));
    const cottage = String(room?.short || room?.name || `Room ${row.roomId}`);
    const importUrl = String(row.importUrl || "").trim();

    if (!importUrl) {
      results.push({
        roomId: row.roomId,
        cottage,
        fetched: 0,
        created: 0,
        updated: 0,
        cancelled: 0,
        skipped: 0,
      });
      continue;
    }

    try {
      const events = await fetchExternalIcalEvents(importUrl);
      const syncResult = await gasPostJson<{
        created?: number;
        updated?: number;
        cancelled?: number;
        skipped?: number;
        lastSyncedAt?: string;
        createdEvents?: Array<{ checkIn?: string; checkOut?: string }>;
      }>({
        action: "syncIcalRoomBlocks",
        roomId: row.roomId,
        cottage,
        events: events.map((ev) => ({
          uid: ev.uid,
          checkIn: ev.start,
          checkOut: ev.end,
          summary: ev.summary || "",
        })),
        exportUidSuffix: ICAL_UID_SUFFIX,
      });

      const created = Number(syncResult.created) || 0;
      const syncedAt = syncResult.lastSyncedAt || new Date().toISOString();
      nextRooms[i] = {
        ...row,
        lastSyncedAt: syncedAt,
        lastError: null,
      };
      results.push({
        roomId: row.roomId,
        cottage,
        fetched: events.length,
        created,
        updated: Number(syncResult.updated) || 0,
        cancelled: Number(syncResult.cancelled) || 0,
        skipped: Number(syncResult.skipped) || 0,
      });

      if (created > 0) {
        const first = Array.isArray(syncResult.createdEvents)
          ? syncResult.createdEvents[0]
          : null;
        try {
          await notifyBookingComSync({
            cottage,
            created,
            checkIn: first?.checkIn,
            checkOut: first?.checkOut,
          });
        } catch (notifyErr) {
          console.error("[ical-sync] Booking.com notify failed", notifyErr);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        await gasPostJson({
          action: "patchIcalRoomMeta",
          roomId: row.roomId,
          lastError: message,
        });
      } catch {
        /* ignore */
      }
      nextRooms[i] = {
        ...row,
        lastError: message,
      };
      results.push({
        roomId: row.roomId,
        cottage,
        fetched: 0,
        created: 0,
        updated: 0,
        cancelled: 0,
        skipped: 0,
        error: message,
      });
    }
  }

  return {
    results,
    settings: {
      exportSecret: settings.exportSecret,
      rooms: nextRooms,
    },
  };
}
