import type { IcalRoomSyncConfig, IcalSyncSettings } from "./types";

export function createEmptyIcalSyncSettings(): IcalSyncSettings {
  return { exportSecret: "", rooms: [] };
}

export function normalizeIcalSyncSettings(
  raw: unknown,
  roomIds: Array<number | string> = []
): IcalSyncSettings {
  const src =
    raw && typeof raw === "object" ? (raw as Partial<IcalSyncSettings>) : {};
  const byId = new Map<number, IcalRoomSyncConfig>();
  for (const row of Array.isArray(src.rooms) ? src.rooms : []) {
    const roomId = Number(row?.roomId);
    if (!Number.isFinite(roomId)) continue;
    byId.set(roomId, {
      roomId,
      importUrl: String(row.importUrl || "").trim() || undefined,
      lastSyncedAt: row.lastSyncedAt ? String(row.lastSyncedAt) : undefined,
      lastError: row.lastError == null ? null : String(row.lastError),
    });
  }

  const rooms: IcalRoomSyncConfig[] = [];
  const ids =
    roomIds.length > 0
      ? roomIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : Array.from(byId.keys());

  for (const roomId of ids) {
    const existing = byId.get(roomId);
    rooms.push(
      existing || {
        roomId,
        importUrl: undefined,
        lastSyncedAt: undefined,
        lastError: null,
      }
    );
  }

  return {
    exportSecret: String(src.exportSecret || "").trim(),
    rooms,
  };
}

export function generateIcalExportSecret(): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildIcalExportUrl(params: {
  origin: string;
  roomId: number | string;
  exportSecret: string;
}): string {
  const origin = String(params.origin || "").replace(/\/$/, "");
  const secret = encodeURIComponent(params.exportSecret);
  return `${origin}/api/ical/${params.roomId}?s=${secret}`;
}

export function getPublicIcalOrigin(): string {
  if (typeof window !== "undefined") {
    const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (fromEnv) return fromEnv.replace(/\/$/, "");
    return window.location.origin.replace(/\/$/, "");
  }
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    process.env.MONO_PUBLIC_ORIGIN?.trim().replace(/\/$/, "") ||
    "https://azhunebi.com"
  );
}
