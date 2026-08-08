import { createServiceSupabase } from "@/lib/supabase";

export type DbBookingRow = {
  id: string;
  room_id: string | null;
  check_in: string | null;
  check_out: string | null;
  status: string | null;
  name: string | null;
  phone: string | null;
  total_price: number | null;
  paid_amount: number | null;
  comment: string | null;
  source: string | null;
  created_at: string | null;
  payments: unknown;
  change_history: unknown;
  guest_details: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
};

export type DbRoomRow = {
  id: string;
  name: string | null;
  capacity: number | null;
  priceweekday: number | null;
  priceweekend: number | null;
  active: boolean | null;
  photos: unknown;
  rules: Record<string, unknown> | null;
};

export type ApiBooking = Record<string, unknown>;
export type ApiRoom = Record<string, unknown>;

const BOOKING_META_KEYS = [
  "discountAmount",
  "manualDiscountAmount",
  "extraGuestFee",
  "petFee",
  "dayGuestFee",
  "earlyFee",
  "lateFee",
  "basePrice",
  "prepayAmount",
  "prepayMethod",
  "surchargeAmount",
  "surchargeMethod",
  "paymentExpiresAt",
  "expiredAt",
  "monoInvoiceId",
  "monoPageUrl",
  "paymentLinkSmsSentAt",
  "successSmsSentAt",
  "expirySmsSentAt",
  "paidTelegramSentAt",
  "assignmentState",
  "custom_color",
  "sheetRow",
] as const;

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
  "guests",
  "pets",
  "cottage",
  "row",
]);

function asDateKey(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Calendar date in Kyiv-safe ISO date (UTC date of local Y-M-D via sv-SE)
    return value.toLocaleDateString("sv-SE", { timeZone: "Europe/Kyiv" });
  }
  const s = String(value ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s.slice(0, 10) || null;
}

function numOrNull(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function feeValue(v: unknown) {
  return v !== undefined && v !== null && v !== "" ? v : "";
}

/** DB row → flat GAS bookingRowToApi shape. */
export function dbBookingToApi(row: DbBookingRow, listIndex = 0): ApiBooking {
  const meta = (row.meta && typeof row.meta === "object" ? row.meta : {}) as Record<
    string,
    unknown
  >;
  const gd = (row.guest_details && typeof row.guest_details === "object"
    ? row.guest_details
    : {}) as Record<string, unknown>;

  const sheetRow = meta.sheetRow ?? meta.row;
  return {
    row: sheetRow != null ? Number(sheetRow) || listIndex + 1 : listIndex + 1,
    id: row.id,
    roomId: row.room_id != null && row.room_id !== "" ? row.room_id : undefined,
    checkIn: row.check_in || "",
    checkOut: row.check_out || "",
    cottage: gd.cottage ?? "",
    status: row.status || "",
    name: row.name || "",
    phone: row.phone || "",
    guests: gd.guests ?? 2,
    pets: gd.pets ?? "Ні",
    totalPrice: row.total_price ?? 0,
    paidAmount: row.paid_amount ?? 0,
    discountAmount: feeValue(meta.discountAmount),
    manualDiscountAmount:
      meta.manualDiscountAmount !== undefined && meta.manualDiscountAmount !== null
        ? feeValue(meta.manualDiscountAmount)
        : undefined,
    source: row.source || "Адмінка",
    createdAt: row.created_at || "",
    comment: row.comment ?? "",
    extraGuestFee: feeValue(meta.extraGuestFee),
    petFee: feeValue(meta.petFee),
    dayGuestFee: feeValue(meta.dayGuestFee),
    earlyFee: feeValue(meta.earlyFee),
    lateFee: feeValue(meta.lateFee),
    basePrice: feeValue(meta.basePrice),
    prepayAmount: feeValue(meta.prepayAmount),
    prepayMethod: meta.prepayMethod || "ФОП",
    surchargeAmount: feeValue(meta.surchargeAmount),
    surchargeMethod: meta.surchargeMethod || "Готівка",
    payments: Array.isArray(row.payments) ? row.payments : [],
    paymentExpiresAt: meta.paymentExpiresAt || "",
    expiredAt: meta.expiredAt || "",
    monoInvoiceId: meta.monoInvoiceId || "",
    monoPageUrl: meta.monoPageUrl || "",
    paymentLinkSmsSentAt: meta.paymentLinkSmsSentAt || "",
    successSmsSentAt: meta.successSmsSentAt || "",
    expirySmsSentAt: meta.expirySmsSentAt || "",
    paidTelegramSentAt: meta.paidTelegramSentAt || "",
    assignmentState: meta.assignmentState === "holding" ? "holding" : "assigned",
    custom_color: meta.custom_color != null ? String(meta.custom_color) : "",
  };
}

/** Flat API booking → DB upsert row. */
export function apiBookingToDb(
  raw: ApiBooking,
  changeHistory?: unknown[]
): DbBookingRow | null {
  const id = String(raw.id ?? "").trim();
  if (!id) return null;

  const roomId = raw.roomId ?? raw.room_id;
  const guest_details: Record<string, unknown> = {};
  if (raw.guests !== undefined && raw.guests !== "") guest_details.guests = raw.guests;
  if (raw.pets !== undefined && raw.pets !== "") guest_details.pets = raw.pets;
  if (raw.cottage !== undefined && raw.cottage !== "") guest_details.cottage = raw.cottage;

  const meta: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (BOOKING_COLUMN_KEYS.has(key)) continue;
    if (value === undefined) continue;
    meta[key] = value;
  }
  if (raw.row !== undefined) meta.sheetRow = raw.row;

  // Prefer known meta keys from raw even if already in meta
  for (const k of BOOKING_META_KEYS) {
    if (raw[k] !== undefined) meta[k] = raw[k];
  }

  const history = Array.isArray(changeHistory)
    ? changeHistory
    : Array.isArray(raw.change_history)
      ? (raw.change_history as unknown[])
      : Array.isArray(raw.changeHistory)
        ? (raw.changeHistory as unknown[])
        : [];

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
    change_history: history,
    guest_details,
    meta,
  };
}

/** DB room → GAS roomConfig shape. */
export function dbRoomToApi(row: DbRoomRow): ApiRoom {
  const rulesObj =
    row.rules && typeof row.rules === "object" && !Array.isArray(row.rules)
      ? { ...row.rules }
      : {};
  const extras =
    rulesObj._extras && typeof rulesObj._extras === "object"
      ? (rulesObj._extras as Record<string, unknown>)
      : {};
  delete rulesObj._extras;

  const hasOriginalRules = Object.keys(rulesObj).length > 0;

  const numOrUndef = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  return {
    id: /^\d+$/.test(row.id) ? Number(row.id) : row.id,
    name: row.name || "",
    short: String(extras.short ?? row.name ?? ""),
    desc: String(extras.desc ?? ""),
    capacity: row.capacity ?? 2,
    maxCapacity: extras.maxCapacity,
    extraGuestPrice: extras.extraGuestPrice ?? 2500,
    pricingModel: extras.pricingModel === "per_guest" ? "per_guest" : "per_house",
    pricePerGuest: numOrUndef(extras.pricePerGuest),
    pricePerGuestOneNight: numOrUndef(extras.pricePerGuestOneNight),
    priceWeekday: row.priceweekday ?? 0,
    priceWeekend: row.priceweekend ?? 0,
    weekendDays: Array.isArray(extras.weekendDays)
      ? extras.weekendDays
          .map((v) => Number(v))
          .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
      : undefined,
    priceOneNightWeekday: numOrUndef(extras.priceOneNightWeekday),
    priceOneNightWeekend: numOrUndef(extras.priceOneNightWeekend),
    active: row.active !== false,
    availabilityStatus:
      extras.availabilityStatus ?? (row.active === false ? "disabled" : "enabled"),
    photos: Array.isArray(row.photos) ? row.photos : [],
    detailedDescription: String(extras.detailedDescription ?? ""),
    rules: hasOriginalRules ? rulesObj : extras.rules,
    amenities: extras.amenities,
    siteHighlights: extras.siteHighlights ?? [],
    allowChildren: extras.allowChildren !== false,
    minChildAge: extras.minChildAge,
  };
}

/** GAS roomConfig → DB row. */
export function apiRoomToDb(raw: ApiRoom): DbRoomRow | null {
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
  if (Object.keys(extras).length) rules._extras = extras;

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

export function getDb() {
  return createServiceSupabase();
}
