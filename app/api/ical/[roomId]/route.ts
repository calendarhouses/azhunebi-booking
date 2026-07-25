import { NextResponse } from "next/server";
import { fetchCronTelegramDigest } from "@/lib/telegram/cronDigest";
import { generateIcalFeed } from "@/lib/ical/export";
import type { IcalExportBooking } from "@/lib/ical/export";
import { normalizeIcalSyncSettings } from "@/lib/ical/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ roomId: string }> };

export async function GET(request: Request, context: Ctx) {
  const { roomId: roomIdRaw } = await context.params;
  const roomId = Number(roomIdRaw);
  if (!Number.isFinite(roomId) || roomId <= 0) {
    return NextResponse.json({ error: "INVALID_ROOM" }, { status: 400 });
  }

  const url = new URL(request.url);
  const secret = String(url.searchParams.get("s") || "").trim();
  if (!secret) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const digest = await fetchCronTelegramDigest();
    const roomsList = Array.isArray(digest.settings.roomsList)
      ? (digest.settings.roomsList as Array<{
          id: number | string;
          name?: string;
          short?: string;
          active?: boolean;
        }>)
      : [];
    const room = roomsList.find((r) => String(r.id) === String(roomId));
    if (!room) {
      return NextResponse.json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
    }

    const icalSettings = normalizeIcalSyncSettings(
      digest.settings.icalSyncSettings,
      roomsList.map((r) => r.id)
    );
    if (!icalSettings.exportSecret || icalSettings.exportSecret !== secret) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const roomName = String(room.short || room.name || `Room ${roomId}`);
    const labels = [room.short, room.name].filter(Boolean).map(String);
    const ics = generateIcalFeed({
      roomId,
      roomName,
      roomLabels: labels,
      bookings: digest.bookings as IcalExportBooking[],
      calendarName: `Аж у небі · ${roomName}`,
    });

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="room-${roomId}.ics"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("[ical export]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "EXPORT_FAILED" },
      { status: 500 }
    );
  }
}
