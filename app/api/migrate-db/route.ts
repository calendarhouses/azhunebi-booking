import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One-shot Lift-and-Shift: GAS (Sheets) → Supabase.
 *
 * POST/GET /api/migrate-db
 * Authorization: Bearer <CRON_SECRET | MIGRATE_SECRET | TELEGRAM_CRON_SECRET>
 *
 * bookings columns:
 *   id, room_id, check_in, check_out, status, name, phone,
 *   total_price, paid_amount, comment, source, created_at,
 *   payments, change_history, guest_details, meta
 *
 * rooms columns:
 *   id, name, capacity, priceweekday, priceweekend, active, photos, rules
 *   (усі зайві поля кімнати → всередині rules як JSONB extras)
 *
 * settings: key / value (jsonb)
 * guest_profiles: phone, rating, note, updated_at
 */

type GasBooking = Record<string, unknown>;
type GasRoom = Record<string, unknown>;

type Snapshot = {
  rooms: GasRoom[];
  bookings: GasBooking[];
  settings: Record<string, unknown>;
  guestProfiles: Record<string, { rating?: number | null; note?: string; updatedAt?: string }>;
  changeHistories: Record<string, unknown[]>;
};

function authorize(request: Request): boolean {
  const secret =
    process.env.MIGRATE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.TELEGRAM_CRON_SECRET?.trim() ||
    "";
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

async function gasPost(
  body: Record<string, unknown>,
  token?: string
): Promise<Record<string, unknown>> {
  const gasUrl = process.env.NEXT_PUBLIC_GAS_URL?.trim();
  if (!gasUrl) throw new Error("NEXT_PUBLIC_GAS_URL is not set");

  const payload = { ...body };
  if (token && payload.accessToken === undefined) payload.accessToken = token;

  const headers: Record<string, string> = {
    "Content-Type": "text/plain;charset=utf-8",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(gasUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !json || json.error) {
    throw new Error(
      String(json?.message || json?.error || `GAS failed (${res.status})`)
    );
  }
  return json;
}

function asDateKey(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s.slice(0, 10) || null;
}

function numOrNull(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchGasSnapshot(): Promise<Snapshot> {
  const email =
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.GAS_ADMIN_EMAIL?.trim() ||
    "Azhunebi2026";
  const password =
    process.env.ADMIN_PASSWORD?.trim() ||
    process.env.GAS_ADMIN_PASSWORD?.trim() ||
    "azhunebi12345";

  const login = await gasPost({
    action: "login",
    email: email.trim().toLowerCase(),
    password,
  });
  const token = String(login.accessToken || "");
  if (!token) throw new Error("GAS login failed — no accessToken");

  const init = await gasPost({ action: "adminInitData", tenant_id: "default" }, token);
  const settings =
    init.settings && typeof init.settings === "object"
      ? (init.settings as Record<string, unknown>)
      : {};
  const bookings = Array.isArray(init.bookings) ? (init.bookings as GasBooking[]) : [];
  const roomsList = Array.isArray(settings.roomsList)
    ? (settings.roomsList as GasRoom[])
    : Array.isArray(init.rooms)
      ? (init.rooms as GasRoom[])
      : [];

  let guestProfiles: Snapshot["guestProfiles"] = {};
  try {
    const gp = await gasPost({ action: "getGuestProfiles" }, token);
    if (gp.profiles && typeof gp.profiles === "object") {
      guestProfiles = gp.profiles as Snapshot["guestProfiles"];
    }
  } catch (err) {
    console.warn("[migrate-db] getGuestProfiles skipped:", err);
  }

  let changeHistories: Record<string, unknown[]> = {};
  try {
    const hist = await gasPost({ action: "exportBookingChangeHistories" }, token);
    if (hist.histories && typeof hist.histories === "object") {
      changeHistories = hist.histories as Record<string, unknown[]>;
    }
    console.info("[migrate-db] change_history bookings with data:", hist.count ?? 0);
  } catch (err) {
    console.warn("[migrate-db] exportBookingChangeHistories skipped:", err);
  }

  return {
    rooms: roomsList,
    bookings,
    settings,
    guestProfiles,
    changeHistories,
  };
}

/** Top-level booking columns — everything else goes to meta / guest_details. */
const BOOKING_COLUMN_KEYS = new Set([
  "id",
  "roomId",
  "room_id",
  "checkIn",
  "check_in",
  "checkOut",
  "check_out",
  "status",
  "name",
  "phone",
  "totalPrice",
  "total_price",
  "paidAmount",
  "paid_amount",
  "comment",
  "source",
  "createdAt",
  "created_at",
  "payments",
  "change_history",
  "changeHistory",
  // guest_details
  "guests",
  "pets",
  "cottage",
  // internal / unused as top-level
  "row",
]);

function mapBooking(
  raw: GasBooking,
  changeHistories: Record<string, unknown[]>
): Record<string, unknown> | null {
  const id = String(raw.id ?? "").trim();
  if (!id) return null;

  const roomId = raw.roomId ?? raw.room_id;
  const fromMap = changeHistories[id];
  const changeHistory = Array.isArray(fromMap)
    ? fromMap
    : Array.isArray(raw.change_history)
      ? raw.change_history
      : Array.isArray(raw.changeHistory)
        ? raw.changeHistory
        : [];

  const guest_details: Record<string, unknown> = {};
  if (raw.guests !== undefined && raw.guests !== "") guest_details.guests = raw.guests;
  if (raw.pets !== undefined && raw.pets !== "") guest_details.pets = raw.pets;
  if (raw.cottage !== undefined && raw.cottage !== "") {
    guest_details.cottage = raw.cottage;
  }

  const meta: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (BOOKING_COLUMN_KEYS.has(key)) continue;
    if (value === undefined) continue;
    meta[key] = value;
  }
  // Keep sheet row index for debugging / reverse sync.
  if (raw.row !== undefined) meta.sheetRow = raw.row;

  return {
    id,
    room_id: roomId != null && String(roomId).trim() !== "" ? String(roomId) : null,
    check_in: asDateKey(raw.checkIn ?? raw.check_in),
    check_out: asDateKey(raw.checkOut ?? raw.check_out),
    status: String(raw.status || "").trim() || null,
    name: String(raw.name || "").trim() || null,
    phone: String(raw.phone || "").trim() || null,
    total_price: numOrNull(raw.totalPrice ?? raw.total_price) ?? 0,
    paid_amount: numOrNull(raw.paidAmount ?? raw.paid_amount) ?? 0,
    comment: raw.comment != null ? String(raw.comment) : null,
    source: String(raw.source || "").trim() || null,
    created_at: String(raw.createdAt ?? raw.created_at ?? "").trim() || null,
    payments: Array.isArray(raw.payments) ? raw.payments : [],
    change_history: changeHistory,
    guest_details,
    meta,
  };
}

/**
 * rooms table has fixed columns; pack every other room field into `rules` JSONB
 * under `_extras` so nothing is lost (photos stay as photos[]).
 */
function mapRoom(raw: GasRoom): Record<string, unknown> | null {
  const id = String(raw.id ?? "").trim();
  if (!id) return null;

  const photos = Array.isArray(raw.photos) ? raw.photos : [];
  const originalRules =
    raw.rules && typeof raw.rules === "object" && !Array.isArray(raw.rules)
      ? (raw.rules as Record<string, unknown>)
      : {};

  const extras: Record<string, unknown> = {};
  const topKeys = new Set([
    "id",
    "name",
    "capacity",
    "priceWeekday",
    "priceWeekend",
    "priceweekday",
    "priceweekend",
    "active",
    "photos",
    "rules",
  ]);
  for (const [key, value] of Object.entries(raw)) {
    if (topKeys.has(key)) continue;
    if (value === undefined) continue;
    extras[key] = value;
  }

  const rules: Record<string, unknown> = { ...originalRules };
  if (Object.keys(extras).length) {
    rules._extras = extras;
  }

  return {
    id,
    name: String(raw.name || raw.short || "").trim() || id,
    capacity: Math.max(0, Math.round(Number(raw.capacity) || 0)) || null,
    priceweekday: Number(raw.priceWeekday ?? raw.priceweekday) || 0,
    priceweekend: Number(raw.priceWeekend ?? raw.priceweekend) || 0,
    active: raw.active === false || raw.active === "false" || raw.active === 0 ? false : true,
    photos,
    rules,
  };
}

function mapSettingsRows(settings: Record<string, unknown>): Array<{ key: string; value: unknown }> {
  // roomsList lives in `rooms` table — still keep a copy in settings for parity/debug.
  const rows: Array<{ key: string; value: unknown }> = [];
  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined) continue;
    rows.push({ key, value });
  }
  return rows;
}

function mapGuestProfiles(
  profiles: Snapshot["guestProfiles"]
): Array<{
  phone: string;
  rating: number | null;
  note: string | null;
  updated_at: string | null;
}> {
  return Object.entries(profiles)
    .map(([phone, p]) => {
      const digits = String(phone || "").replace(/\D/g, "");
      if (!digits) return null;
      const ratingRaw = p?.rating;
      const rating =
        ratingRaw == null || ratingRaw === ("" as unknown)
          ? null
          : Math.round(Number(ratingRaw));
      return {
        phone: digits,
        rating: Number.isFinite(rating as number) ? (rating as number) : null,
        note: p?.note != null ? String(p.note).slice(0, 500) : null,
        updated_at: p?.updatedAt ? String(p.updatedAt) : null,
      };
    })
    .filter(Boolean) as Array<{
    phone: string;
    rating: number | null;
    note: string | null;
    updated_at: string | null;
  }>;
}

async function upsertInChunks(
  table: string,
  rows: Array<Record<string, unknown>>,
  onConflict: string,
  chunkSize = 80
): Promise<number> {
  if (!rows.length) return 0;
  const sb = createServiceSupabase();
  let written = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error, count } = await sb.from(table).upsert(chunk, {
      onConflict,
      count: "exact",
    });
    if (error) {
      throw new Error(`${table} upsert failed at offset ${i}: ${error.message}`);
    }
    written += count ?? chunk.length;
  }
  return written;
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    console.info("[migrate-db] fetching GAS snapshot…");
    const snap = await fetchGasSnapshot();

    const rooms = snap.rooms.map(mapRoom).filter(Boolean) as Array<Record<string, unknown>>;
    const bookings = snap.bookings
      .map((b) => mapBooking(b, snap.changeHistories))
      .filter(Boolean) as Array<Record<string, unknown>>;
    const settingsRows = mapSettingsRows(snap.settings);
    const guests = mapGuestProfiles(snap.guestProfiles);

    const bookingsWithMeta = bookings.filter(
      (b) => b.meta && typeof b.meta === "object" && Object.keys(b.meta as object).length > 0
    ).length;
    const bookingsWithHistory = bookings.filter(
      (b) => Array.isArray(b.change_history) && (b.change_history as unknown[]).length > 0
    ).length;
    const roomsWithExtras = rooms.filter((r) => {
      const rules = r.rules as Record<string, unknown> | undefined;
      return Boolean(rules && rules._extras && typeof rules._extras === "object");
    }).length;

    console.info("[migrate-db] upserting", {
      rooms: rooms.length,
      bookings: bookings.length,
      settings: settingsRows.length,
      guests: guests.length,
      bookingsWithMeta,
      bookingsWithHistory,
    });

    const roomsWritten = await upsertInChunks("rooms", rooms, "id");
    const bookingsWritten = await upsertInChunks("bookings", bookings, "id");
    const settingsWritten = await upsertInChunks("settings", settingsRows, "key");
    const guestsWritten = await upsertInChunks(
      "guest_profiles",
      guests as Array<Record<string, unknown>>,
      "phone"
    );

    let guestsFromSettings = 0;
    try {
      const { hydrateGuestProfilesFromSettings } = await import(
        "@/lib/db/guestProfiles"
      );
      guestsFromSettings = await hydrateGuestProfilesFromSettings();
    } catch (err) {
      console.warn("[migrate-db] hydrateGuestProfilesFromSettings:", err);
    }

    const result = {
      ok: true,
      source: {
        rooms: snap.rooms.length,
        bookings: snap.bookings.length,
        settingsKeys: settingsRows.map((r) => r.key),
        guestProfiles: Object.keys(snap.guestProfiles).length,
        changeHistoryBookings: Object.keys(snap.changeHistories).length,
      },
      upserted: {
        rooms: roomsWritten,
        bookings: bookingsWritten,
        settings: settingsWritten,
        guest_profiles: guestsWritten,
        guest_profiles_from_settings: guestsFromSettings,
      },
      details: {
        bookingsWithMeta,
        bookingsWithChangeHistory: bookingsWithHistory,
        roomsWithExtrasInRules: roomsWithExtras,
        sampleBookingId: bookings[0]?.id ?? null,
        sampleMetaKeys:
          bookings[0]?.meta && typeof bookings[0].meta === "object"
            ? Object.keys(bookings[0].meta as object).slice(0, 40)
            : [],
      },
    };

    console.info("[migrate-db] done", result.upserted, result.details);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[migrate-db]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
