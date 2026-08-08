// ==========================================
// 🚀 DuzhTech | BOSO Custom Booking API
// ==========================================

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { extractBearerToken } from "@/lib/admin/adminDbClient";
import { verifyAdminRequest } from "@/lib/admin/verifyAdminRequest";
import {
  createBooking,
  fetchInitData,
  gasFetch,
  gasPost,
} from "@/lib/gas-api";
import {
  bookingsShareSameRoom,
  findRoomForBooking,
  resolveRoomIdForCottage,
  type RoomLike,
} from "@/lib/admin/roomBookingMatch";
import { getBookingStatusByDisplayId } from "@/lib/payments/confirmBookingPayment";
import {
  calculatePrepaymentAmount,
  readPrepaymentPolicy,
} from "@/lib/public-booking/prepaymentPolicy";
import {
  notifyPendingBookingReview,
} from "@/lib/telegram/bookingReviewNotify";
import { BOOKING_STATUS_PENDING_REVIEW } from "@/lib/public-booking/bookingReview";

export const runtime = "nodejs";

const FAKE = "FAKE_TEST_KEY_DO_NOT_TOUCH";

const ssApiKey = FAKE;
const GOOGLE_CLIENT_ID = FAKE;
const ADMIN_ALLOWED_EMAILS = [
  "bosoclubresort@gmail.com",
  "bo9dantkach@gmail.com",
  "tkach.iurii@gmail.com",
  "nazar.duzhik02222@gmail.com",
];

const BOOKING_COL = { SURCHARGE_AMOUNT: 27 };

const HUTSHUB_URLS: Record<string, string> = {
  "JUNIOR 1": `https://api.hutshub.com/v1/admin/houses/ical/663912eba619e76b6cd6c806.ics?s=${FAKE}`,
  "FAMILY №2": `https://api.hutshub.com/v1/admin/houses/ical/6825ce9ddc7dfecd4bd8e66b.ics?s=${FAKE}`,
  "FAMILY №3": `https://api.hutshub.com/v1/admin/houses/ical/6838489da6ce68f94a25c427.ics?s=${FAKE}`,
  "FAMILY №4": `https://api.hutshub.com/v1/admin/houses/ical/683848a2a6ce68f94a25c429.ics?s=${FAKE}`,
};

const TG_CONFIG = {
  botToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || FAKE,
  testChatId: process.env.TELEGRAM_TEST_CHAT_ID?.trim() || FAKE,
  adminGroupId: process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() || FAKE,
  adminOpsThreadId: process.env.TELEGRAM_ADMIN_OPS_THREAD_ID
    ? Number(process.env.TELEGRAM_ADMIN_OPS_THREAD_ID)
    : null,
  adminFinanceThreadId: process.env.TELEGRAM_ADMIN_FINANCE_THREAD_ID
    ? Number(process.env.TELEGRAM_ADMIN_FINANCE_THREAD_ID)
    : 189,
  cleaningGroupId: process.env.TELEGRAM_CLEANING_CHAT_ID?.trim() || "-5577418097",
  isTestMode: process.env.TELEGRAM_TEST_MODE === "true",
};

const TG_PHOTOS = {
  eveningKasa: "https://imgpx.com/EViIbZwXrCL3.webp",
  debtReminder: "https://imgpx.com/6tgc72IDljqM.webp",
};

// --- In-memory admin sessions (GAS: PropertiesService) ---
const adminSessions: Record<string, string> = {};

// --- Kyiv date helpers (GAS: Utilities.formatDate Europe/Kiev) ---
function formatDateKyiv(date: Date, fmt: string): string {
  if (fmt === "yyyy-MM-dd") {
    return date.toLocaleDateString("sv-SE", { timeZone: "Europe/Kyiv" });
  }
  if (fmt === "yyyy-MM-dd HH:mm:ss") {
    const d = date.toLocaleDateString("sv-SE", { timeZone: "Europe/Kyiv" });
    const t = date.toLocaleTimeString("en-GB", {
      timeZone: "Europe/Kyiv",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return `${d} ${t}`;
  }
  if (fmt === "yyyy") return date.toLocaleDateString("sv-SE", { timeZone: "Europe/Kyiv", year: "numeric" }).slice(0, 4);
  if (fmt === "MM") {
    const m = date.toLocaleDateString("sv-SE", { timeZone: "Europe/Kyiv", month: "2-digit" });
    return m;
  }
  if (fmt === "u") {
    const wd = new Date(date.toLocaleString("en-US", { timeZone: "Europe/Kyiv" })).getDay();
    return String(wd === 0 ? 7 : wd);
  }
  return date.toISOString();
}

/** dd.MM.yyyy або yyyy-MM-dd → yyyy-MM-dd для колонок DATE */
function normalizeBookingDateForDb(value: unknown): string {
  const str = String(value ?? "").trim();
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const dotted = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotted) {
    const [, d, m, y] = dotted;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(str.includes("T") ? str : `${str}T12:00:00`);
  if (!isNaN(parsed.getTime())) return formatDateKyiv(parsed, "yyyy-MM-dd");
  return str;
}

function jsonResponse(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function adminUnauthorizedResponse() {
  return jsonResponse({ error: "UNAUTHORIZED", message: "У доступі відмовлено" }, { status: 401 });
}

function missingTenantResponse() {
  return jsonResponse(
    {
      error: "MISSING_TENANT",
      message: "Потрібен tenant_id (query ?tenant_id=, заголовок x-tenant-id або поле body)",
    },
    { status: 400 }
  );
}

function isDevelopment(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** SaaS: tenant з query, заголовка x-tenant-id або body (POST). Без env-fallback. */
function resolveTenantId(
  searchParams?: Record<string, string>,
  headers?: Headers,
  body?: Record<string, unknown>
): string | null {
  const raw =
    body?.tenant_id ??
    body?.tenantId ??
    searchParams?.tenant_id ??
    searchParams?.tenantId ??
    headers?.get("x-tenant-id") ??
    headers?.get("X-Tenant-Id");
  if (!raw) return null;
  const id = String(raw).trim();
  return id || null;
}

// --- GET / POST entry points ---
export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const params = Object.fromEntries(url.searchParams.entries());

  if (action === "checkStatus") {
    const orderId = url.searchParams.get("orderId");
    if (!orderId) {
      return jsonResponse({ status: "Нова бронь" });
    }
    const status = (await getBookingStatusByDisplayId(orderId)) ?? "Нова бронь";
    return jsonResponse({ status });
  }

  if (action === "exportICS") {
    const roomName = url.searchParams.get("roomName");
    if (!roomName) return new NextResponse("Error: roomName is required", { status: 400 });
    const icsData = generateIcalFeed(roomName);
    return new NextResponse(icsData, {
      headers: { "Content-Type": "text/calendar; charset=utf-8" },
    });
  }

  if (action === "initData") {
    const tenantId = resolveTenantId(params, request.headers);
    if (!tenantId) return missingTenantResponse();
    try {
      return jsonResponse(await fetchInitData(tenantId));
    } catch (err) {
      return jsonResponse({ error: "DB_ERROR", message: String(err) }, { status: 500 });
    }
  }

  if (action === "adminInitData") {
    const tenantId = resolveTenantId(params, request.headers);
    if (!tenantId) return missingTenantResponse();
    const authBlock = await verifyAdminRequest(request, tenantId);
    if (authBlock instanceof NextResponse) return authBlock;
    const authToken = extractBearerToken(request);
    if (!authToken) return adminUnauthorizedResponse();
    try {
      return jsonResponse(await fetchInitData(tenantId, authToken));
    } catch (err) {
      return jsonResponse({ error: "DB_ERROR", message: String(err) }, { status: 500 });
    }
  }

  if (action === "settings") {
    const tenantId = resolveTenantId(params, request.headers);
    if (!tenantId) return missingTenantResponse();
    const authBlock = await verifyAdminRequest(request, tenantId);
    if (authBlock instanceof NextResponse) return authBlock;
    const authToken = extractBearerToken(request);
    if (!authToken) return adminUnauthorizedResponse();
    try {
      return jsonResponse(
        await gasFetch<Record<string, unknown>>(
          { action: "settings", tenant_id: tenantId },
          { authToken }
        )
      );
    } catch (err) {
      return jsonResponse({ error: "DB_ERROR", message: String(err) }, { status: 500 });
    }
  }

  if (action === "getDates") {
    const roomId = url.searchParams.get("roomId");
    const roomName = getRoomNameById(roomId || "");
    return jsonResponse(getBookedDates(roomName));
  }

  if (!action || action === "getAllBookings") {
    const tenantId = resolveTenantId(params, request.headers);
    if (!tenantId) return missingTenantResponse();
    const authBlock = await verifyAdminRequest(request, tenantId);
    if (authBlock instanceof NextResponse) return authBlock;
    const authToken = extractBearerToken(request);
    if (!authToken) return adminUnauthorizedResponse();
    try {
      const data = await gasFetch<{ bookings?: Record<string, unknown>[] }>(
        { action: "getAllBookings", tenant_id: tenantId },
        { authToken }
      );
      return jsonResponse(data.bookings ?? []);
    } catch (err) {
      return jsonResponse({ error: "DB_ERROR", message: String(err) }, { status: 500 });
    }
  }

  return jsonResponse({ status: "ok" });
}

export async function POST(request: Request) {
  let data: Record<string, unknown>;
  try {
    data = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, { status: 400 });
  }
  const action = data.action as string | undefined;

  if (action === "adminLogin") return handleAdminLogin(data);
  if (action === "adminLogout") return handleAdminLogout(data);

  if (action === "devBootstrapSession" && isDevelopment()) {
    const email = String(data.email || ADMIN_ALLOWED_EMAILS[0] || "dev@local")
      .toLowerCase()
      .trim();
    const sessionToken = createAdminSession(email);
    if (!sessionToken) return adminUnauthorizedResponse();
    return jsonResponse({ success: true, sessionToken, email });
  }

  if (action === "sendFinanceReport") {
    const tenantId = resolveTenantId(undefined, request.headers, data);
    const authBlock = await verifyAdminRequest(request, tenantId);
    if (authBlock instanceof NextResponse) return authBlock;
    try {
      const { sendFinanceReportTelegram } = await import("@/lib/telegram/financeNotify");
      const reportResult = await sendFinanceReportTelegram({
        periodLabel: (data.periodLabel as string) || "",
        screenshot: (data.screenshot as string) || "",
      });
      return jsonResponse(reportResult);
    } catch (err) {
      return jsonResponse({ success: false, error: String(err) });
    }
  }

  if (action === "sendSuccessScreenshot") {
    const tenantId = resolveTenantId(undefined, request.headers, data);
    const authBlock = await verifyAdminRequest(request, tenantId);
    if (authBlock instanceof NextResponse) return authBlock;
    const { notifyNewBookingCreated } = await import("@/lib/telegram/newBookingNotify");
    await notifyNewBookingCreated({
      name: String(data.name || ""),
      phone: String(data.phone || ""),
      cottage: String(data.cottage || ""),
      checkIn: String(data.checkIn || ""),
      checkOut: String(data.checkOut || ""),
      guests: Number(data.guests) || 0,
      pets: data.pets as string | boolean | undefined,
      source: String(data.source || "Адмінка"),
      comment: String(data.comment || ""),
      totalPrice: Number(data.totalPrice) || 0,
      paidAmount: Number(data.paidAmount) || 0,
      status: String(data.status || ""),
    });
    return jsonResponse({ success: true });
  }

  // WayForPay serviceUrl → POST /api/webhooks/wayforpay

  if (action === "saveSettings") {
    const tenantId = resolveTenantId(undefined, request.headers, data);
    if (!tenantId) return missingTenantResponse();
    const authBlock = await verifyAdminRequest(request, tenantId);
    if (authBlock instanceof NextResponse) return authBlock;
    const authToken = extractBearerToken(request);
    if (!authToken) return adminUnauthorizedResponse();
    try {
      await gasPost(
        {
          action: "saveSettings",
          tenant_id: tenantId,
          settings: (data.settings as Record<string, unknown>) || {},
          saveKeys: Array.isArray(data.saveKeys) ? data.saveKeys : undefined,
        },
        { authToken }
      );
      return jsonResponse({ success: true });
    } catch (err) {
      console.error("saveSettings:", err);
      return jsonResponse(
        { error: "DB_ERROR", message: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  if (action === "deleteBooking") {
    const tenantId = resolveTenantId(undefined, request.headers, data);
    if (!tenantId) return missingTenantResponse();
    const authBlock = await verifyAdminRequest(request, tenantId);
    if (authBlock instanceof NextResponse) return authBlock;
    const authToken = extractBearerToken(request);
    if (!authToken) return adminUnauthorizedResponse();

    try {
      const result = await gasPost<{ success?: boolean; error?: string }>(
        {
          action: "deleteBooking",
          tenant_id: tenantId,
          row: data.row,
          id: data.id,
        },
        { authToken }
      );
      if (result.error === "NOT_FOUND") {
        return jsonResponse({ error: "NOT_FOUND" }, { status: 404 });
      }
      if (result.error) {
        return jsonResponse({ error: result.error }, { status: 400 });
      }
      return jsonResponse({ success: true });
    } catch (err) {
      console.error("deleteBooking:", err);
      return jsonResponse(
        { error: "DB_ERROR", message: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  if (data.checkIn && data.name) {
    let authToken: string | null = null;
    if (String(data.source || "") !== "Сайт") {
      const tenantId = resolveTenantId(undefined, request.headers, data);
      const authBlock = await verifyAdminRequest(request, tenantId);
      if (authBlock instanceof NextResponse) return authBlock;
      authToken = extractBearerToken(request);
      if (!authToken) return adminUnauthorizedResponse();
    }
    const result = await saveAdminBooking(data as BookingInput, authToken);
    if (result?.error === "MISSING_TENANT") return missingTenantResponse();
    if (result?.error) {
      const errResp: Record<string, unknown> = { success: false, error: result.error };
      if (result.requiredMin !== undefined) errResp.requiredMin = result.requiredMin;
      if (result.nights !== undefined) errResp.nights = result.nights;
      return jsonResponse(errResp);
    }
    if (data.source === "Сайт" && result?.orderId) {
      const bookingStatus = String(data.status || "");
      if (bookingStatus === BOOKING_STATUS_PENDING_REVIEW) {
        await notifyPendingBookingReview({
          orderId: result.orderId,
          name: String(data.name || ""),
          phone: String(data.phone || ""),
          cottage: String(data.cottage || ""),
          checkIn: String(data.checkIn || ""),
          checkOut: String(data.checkOut || ""),
          guests: Number(data.guests) || 2,
          totalPrice: Number(data.totalPrice) || 0,
          prepayAmount: Number(data.prepayAmount) || result.prepayment || 0,
          comment: String(data.comment || ""),
          source: "Сайт",
        });
        return jsonResponse({
          success: true,
          orderId: result.orderId,
          flow: "pending_review",
        });
      }
    }
    if (data.source === "Сайт" && result?.orderId && (result.prepayment ?? 0) > 0) {
      return jsonResponse({
        success: true,
        orderId: result.orderId,
        prepayment: result.prepayment,
        flow: "instant",
      });
    }
    return jsonResponse({ success: true });
  }

  return jsonResponse({ status: "ok" });
}

// --- Types ---
type BookingInput = Record<string, unknown> & {
  tenant_id?: string;
  tenantId?: string;
  id?: string;
  checkIn: string;
  checkOut: string;
  cottage: string;
  roomId?: number | string;
  name: string;
  guests?: number;
  pets?: string;
  source?: string;
  row?: number;
  status?: string;
  phone?: string;
  totalPrice?: number | string;
  paidAmount?: number | string;
  comment?: string;
  extraGuestFee?: number | string;
  petFee?: number | string;
  dayGuestFee?: number | string;
  earlyFee?: number | string;
  lateFee?: number | string;
  basePrice?: number | string;
  prepayAmount?: number | string;
  prepayMethod?: string;
  surchargeAmount?: number | string;
  surchargeMethod?: string;
  payments?: Array<{
    id: string;
    date: string;
    amount: number;
    method: string;
    type: string;
    note?: string;
  }>;
  remainderPaymentAdded?: boolean;
  remainderPaymentAmount?: number;
  screenshotPayment?: string | null;
};

type BookingNotifyData = BookingInput & {
  screenshot?: string;
  screenshotCleaning?: string;
};

type SaveBookingResult = {
  success?: boolean;
  error?: string;
  requiredMin?: number;
  nights?: number;
  orderId?: string;
  prepayment?: number;
};

// --- Admin auth ---
function isAdminEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = String(email).toLowerCase().trim();
  return ADMIN_ALLOWED_EMAILS.some((e) => e.toLowerCase() === normalized);
}

async function verifyGoogleIdToken(idToken: string, expectedEmail: string): Promise<boolean> {
  if (!idToken || !expectedEmail) return false;
  try {
    const resp = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!resp.ok) return false;
    const info = (await resp.json()) as { email?: string; aud?: string; exp?: number };
    if (String(info.email || "").toLowerCase().trim() !== String(expectedEmail).toLowerCase().trim())
      return false;
    if (info.aud !== GOOGLE_CLIENT_ID) return false;
    const now = Math.floor(Date.now() / 1000);
    if (Number(info.exp) < now) return false;
    return isAdminEmailAllowed(info.email);
  } catch {
    return false;
  }
}

function loadAdminSessions(): Record<string, string> {
  return { ...adminSessions };
}

function saveAdminSessions(sessions: Record<string, string>) {
  Object.keys(adminSessions).forEach((k) => delete adminSessions[k]);
  Object.assign(adminSessions, sessions);
}

function createAdminSession(email: string): string | null {
  const normalized = String(email).toLowerCase().trim();
  const effective =
    isDevelopment() && !isAdminEmailAllowed(normalized)
      ? String(ADMIN_ALLOWED_EMAILS[0] || "dev@local").toLowerCase().trim()
      : normalized;
  if (!isDevelopment() && !isAdminEmailAllowed(effective)) return null;
  const sessions = loadAdminSessions();
  const sessionToken =
    randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  sessions[sessionToken] = effective;
  saveAdminSessions(sessions);
  return sessionToken;
}

function revokeAdminSession(sessionToken: string | undefined) {
  if (!sessionToken) return;
  const sessions = loadAdminSessions();
  if (sessions[sessionToken]) {
    delete sessions[sessionToken];
    saveAdminSessions(sessions);
  }
}

function getEmailBySessionToken(sessionToken: string | undefined): string | null {
  if (!sessionToken) return null;
  return loadAdminSessions()[sessionToken] || null;
}

function verifyAdminSession(adminEmail: string, sessionToken: string): boolean {
  if (!sessionToken || !adminEmail) return false;
  if (!isAdminEmailAllowed(adminEmail)) return false;
  const storedEmail = getEmailBySessionToken(sessionToken);
  if (!storedEmail) return false;
  return storedEmail === String(adminEmail).toLowerCase().trim();
}

async function handleAdminLogin(data: Record<string, unknown>) {
  const email = String(data.adminEmail || "")
    .toLowerCase()
    .trim();
  const idToken = data.idToken as string;
  if (!isAdminEmailAllowed(email) || !(await verifyGoogleIdToken(idToken, email))) {
    return adminUnauthorizedResponse();
  }
  const sessionToken = createAdminSession(email);
  if (!sessionToken) return adminUnauthorizedResponse();
  return jsonResponse({ success: true, sessionToken, email });
}

function handleAdminLogout(data: Record<string, unknown>) {
  revokeAdminSession(data.sessionToken as string);
  return jsonResponse({ success: true });
}

// --- Sheet stubs (Supabase later) ---
function getSheet(_name: string) {
  // TODO: Підключити Supabase пізніше
  return null;
}

/** Поля броні в JSONB finance_data (camelCase — як у API адмінки/сайту) */
type BookingFinanceData = {
  cottage?: string;
  guests?: number;
  pets?: string;
  totalPrice?: number;
  paidAmount?: number;
  source?: string;
  comment?: string;
  extraGuestFee?: number | string;
  petFee?: number | string;
  dayGuestFee?: number | string;
  earlyFee?: number | string;
  lateFee?: number | string;
  basePrice?: number | string;
  prepayAmount?: number | string;
  prepayMethod?: string;
  surchargeAmount?: number | string;
  surchargeMethod?: string;
  payments?: Array<{
    id: string;
    date: string;
    amount: number;
    method: string;
    type: string;
    note?: string;
  }>;
  discountAmount?: number;
  extraFees?: number;
  sheet_row?: number;
  roomId?: number | string;
};

type SupabaseBookingRow = {
  id: string;
  tenant_id: string;
  display_id: string;
  check_in: string;
  check_out: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  finance_data: BookingFinanceData | null;
  created_at: string;
};

function parseFinanceData(raw: unknown): BookingFinanceData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as BookingFinanceData;
}

function financeFeeValue(v: number | string | undefined | null) {
  return v !== undefined && v !== null && v !== "" ? v : "";
}

function mapBookingRowToApi(row: SupabaseBookingRow, listIndex: number) {
  if (!row.display_id) return null;
  const fd = parseFinanceData(row.finance_data);
  const checkIn = row.check_in ? normalizeBookingDateForDb(row.check_in) : "";
  const checkOut = row.check_out ? normalizeBookingDateForDb(row.check_out) : "";

  return {
    row: fd.sheet_row ?? listIndex + 1,
    id: row.display_id,
    checkIn,
    checkOut,
    cottage: fd.cottage ?? "",
    roomId: fd.roomId,
    status: row.status,
    name: row.customer_name,
    phone: row.customer_phone,
    guests: fd.guests ?? 2,
    pets: fd.pets ?? "Ні",
    totalPrice: fd.totalPrice ?? 0,
    paidAmount: fd.paidAmount ?? 0,
    source: fd.source ?? "Адмінка",
    comment: fd.comment ?? "",
    extraGuestFee: financeFeeValue(fd.extraGuestFee),
    petFee: financeFeeValue(fd.petFee),
    dayGuestFee: financeFeeValue(fd.dayGuestFee),
    earlyFee: financeFeeValue(fd.earlyFee),
    lateFee: financeFeeValue(fd.lateFee),
    basePrice: financeFeeValue(fd.basePrice),
    discountAmount: financeFeeValue(fd.discountAmount),
    prepayAmount: financeFeeValue(fd.prepayAmount),
    prepayMethod: fd.prepayMethod ?? "",
    surchargeAmount: financeFeeValue(fd.surchargeAmount),
    surchargeMethod: fd.surchargeMethod ?? "",
    payments: Array.isArray(fd.payments) ? fd.payments : undefined,
    createdAt: row.created_at,
  };
}

function buildFinanceDataFromInput(
  data: BookingInput,
  math: {
    basePrice: number;
    discountAmount: number;
    extraFees: number;
  },
  finalTotalPrice: number,
  finalPaidAmount: number
): BookingFinanceData {
  const optFee = (v: unknown) =>
    v !== undefined && v !== null && v !== "" ? v : undefined;

  return {
    cottage: data.cottage,
    roomId:
      data.roomId != null && data.roomId !== ""
        ? (data.roomId as number | string)
        : undefined,
    guests: Number(data.guests) || 2,
    pets: (data.pets as string) || "Ні",
    totalPrice: finalTotalPrice,
    paidAmount: finalPaidAmount,
    source: (data.source as string) || "Адмінка",
    comment: (data.comment as string) || "",
    extraGuestFee: optFee(data.extraGuestFee) as number | string | undefined,
    petFee: optFee(data.petFee) as number | string | undefined,
    dayGuestFee: optFee(data.dayGuestFee) as number | string | undefined,
    earlyFee: optFee(data.earlyFee) as number | string | undefined,
    lateFee: optFee(data.lateFee) as number | string | undefined,
    basePrice: (optFee(data.basePrice) as number | string | undefined) ?? math.basePrice,
    prepayAmount: optFee(data.prepayAmount) as number | string | undefined,
    prepayMethod: (data.prepayMethod as string) || "ФОП",
    surchargeAmount: optFee(data.surchargeAmount) as number | string | undefined,
    surchargeMethod: (data.surchargeMethod as string) || "Готівка",
    payments: Array.isArray(data.payments) ? data.payments : undefined,
    discountAmount: math.discountAmount,
    extraFees: math.extraFees,
    sheet_row: data.row,
  };
}

function findRoomByCottageName(
  roomsList: RoomLike[],
  cottageName: string,
  roomId?: number | string | null
) {
  return findRoomForBooking({ cottage: cottageName, roomId: roomId ?? null }, roomsList);
}

async function getAllBookings(
  tenantId: string,
  authToken?: string | null
): Promise<Record<string, unknown>[]> {
  const data = await gasFetch<{ bookings?: Record<string, unknown>[] }>(
    { action: "getAllBookings", tenant_id: tenantId },
    { authToken }
  );
  return data.bookings ?? [];
}

function getRestrictionMinNightsFromSettings(
  settings: {
    restrictions?: Record<string, Record<string, number>>;
  },
  roomId: string | number,
  dateObj: Date
) {
  const restrictions = settings?.restrictions || {};
  const ds = formatDateKyiv(dateObj, "yyyy-MM-dd");
  const rid = String(roomId);
  const raw = restrictions[roomId as string]?.[ds] ?? restrictions[rid]?.[ds];
  if (raw === undefined || raw === null) return 0;
  const val = Number(raw);
  if (val === -1) return 0;
  return val || 0;
}

function isDateClosedFromSettings(
  settings: {
    closedDates?: Record<string, Record<string, true>>;
    restrictions?: Record<string, Record<string, number>>;
  },
  roomId: string | number,
  dateObj: Date
) {
  const closedDates = settings?.closedDates || {};
  const ds = formatDateKyiv(dateObj, "yyyy-MM-dd");
  const rid = String(roomId);
  if (closedDates[roomId as string]?.[ds] || closedDates[rid]?.[ds]) return true;
  const restrictions = settings?.restrictions || {};
  const raw = restrictions[roomId as string]?.[ds] ?? restrictions[rid]?.[ds];
  return Number(raw) === -1;
}

function hasClosedDateInStay(
  settings: {
    closedDates?: Record<string, Record<string, true>>;
    restrictions?: Record<string, Record<string, number>>;
  },
  room: { id?: number | string },
  checkIn: string,
  checkOut: string
) {
  if (!room?.id) return false;
  const d = new Date(checkIn);
  d.setHours(0, 0, 0, 0);
  const end = new Date(checkOut);
  end.setHours(0, 0, 0, 0);
  while (d < end) {
    if (isDateClosedFromSettings(settings, room.id, d)) return true;
    d.setDate(d.getDate() + 1);
  }
  return false;
}

function getBookingMinNightsRequired(
  settings: { restrictions?: Record<string, Record<string, number>> },
  room: { id?: number | string },
  checkIn: string,
  checkOut: string
) {
  if (!room) return 0;
  let maxMin = 0;
  const d = new Date(checkIn);
  d.setHours(0, 0, 0, 0);
  const end = new Date(checkOut);
  end.setHours(0, 0, 0, 0);
  while (d < end) {
    const m = getRestrictionMinNightsFromSettings(settings, room.id!, d);
    if (m > maxMin) maxMin = m;
    d.setDate(d.getDate() + 1);
  }
  return maxMin;
}

async function validateBookingRestrictions(
  data: BookingInput,
  tenantId: string,
  authToken?: string | null
) {
  const settings = await getSettings(tenantId, authToken);
  const room = findRoomByCottageName(
    (settings.roomsList || []) as RoomLike[],
    data.cottage,
    data.roomId
  );
  if (!room) return { ok: true as const };
  if (hasClosedDateInStay(settings, room, data.checkIn, data.checkOut)) {
    return { ok: false as const, error: "CLOSED_DATES" };
  }
  const d1 = new Date(data.checkIn);
  d1.setHours(0, 0, 0, 0);
  const d2 = new Date(data.checkOut);
  d2.setHours(0, 0, 0, 0);
  const nights = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  const required = getBookingMinNightsRequired(settings, room, data.checkIn, data.checkOut);
  if (required > 0 && nights < required) {
    return { ok: false as const, error: "MIN_STAY", requiredMin: required, nights };
  }
  return { ok: true as const };
}

async function loadTenantBookings(
  tenantId: string,
  authToken?: string | null
): Promise<SupabaseBookingRow[]> {
  const data = await gasFetch<{ rows?: SupabaseBookingRow[] }>(
    { action: "loadTenantBookings", tenant_id: tenantId },
    { authToken }
  );
  return data.rows ?? [];
}

function resolveDisplayIdForUpdate(
  data: BookingInput,
  sortedRows: SupabaseBookingRow[]
): string | null {
  const fromId = data.id != null ? String(data.id).trim() : "";
  if (fromId) return fromId;
  if (data.row && data.row >= 1 && data.row <= sortedRows.length) {
    return sortedRows[data.row - 1].display_id;
  }
  return null;
}

async function saveAdminBooking(
  data: BookingInput,
  authToken?: string | null
): Promise<SaveBookingResult> {
  const tenantId = resolveTenantId(undefined, undefined, data as Record<string, unknown>);
  if (!tenantId) return { error: "MISSING_TENANT" };

  try {
    const result = await createBooking(
      { ...data, tenant_id: tenantId } as Record<string, unknown>,
      authToken
    );
    if (result.error) {
      return {
        error: result.error,
        requiredMin: result.requiredMin,
        nights: result.nights,
      };
    }
    return {
      success: true,
      orderId: result.orderId,
      prepayment: result.prepayment,
    };
  } catch (e) {
    console.error("saveAdminBooking:", e);
    return { error: "DB_ERROR" };
  }
}

function mapTenantSettingsToApi(row: Record<string, unknown> | null): Record<string, unknown> {
  if (!row) return {};
  const settings: Record<string, unknown> = {};

  const columnMap: [string, string][] = [
    ["rooms_list", "roomsList"],
    ["custom_prices", "customPrices"],
    ["discounts_list", "discountsList"],
    ["custom_services_list", "customServicesList"],
    ["flexible_schedule_settings", "flexibleScheduleSettings"],
    ["sys_services_list", "sysServicesList"],
  ];
  for (const [dbKey, apiKey] of columnMap) {
    if (row[dbKey] !== undefined && row[dbKey] !== null) settings[apiKey] = row[dbKey];
  }
  if (row.restrictions !== undefined && row.restrictions !== null)
    settings.restrictions = row.restrictions;
  if (row.closed_dates !== undefined && row.closed_dates !== null)
    settings.closedDates = row.closed_dates;
  if (row.transactions !== undefined && row.transactions !== null)
    settings.transactions = row.transactions;
  if (row.branding !== undefined && row.branding !== null) settings.branding = row.branding;

  return settings;
}

/** AdminSettingsPayload (camelCase) → колонки tenant_settings (snake_case) */
function mapApiSettingsToDb(
  tenantId: string,
  settings: Record<string, unknown>
): Record<string, unknown> {
  const row: Record<string, unknown> = { tenant_id: tenantId };

  const fieldMap: [string, string][] = [
    ["roomsList", "rooms_list"],
    ["discountsList", "discounts_list"],
    ["customServicesList", "custom_services_list"],
    ["flexibleScheduleSettings", "flexible_schedule_settings"],
    ["sysServicesList", "sys_services_list"],
    ["customPrices", "custom_prices"],
    ["restrictions", "restrictions"],
    ["closedDates", "closed_dates"],
    ["transactions", "transactions"],
    ["branding", "branding"],
  ];

  for (const [apiKey, dbKey] of fieldMap) {
    if (settings[apiKey] !== undefined) row[dbKey] = settings[apiKey];
  }

  return row;
}

async function getSettings(
  tenantId: string,
  authToken?: string | null
): Promise<Record<string, unknown>> {
  return gasFetch<Record<string, unknown>>(
    { action: "settings", tenant_id: tenantId },
    { authToken }
  );
}

async function saveSettings(
  tenantId: string,
  settingsObj: Record<string, unknown>,
  authToken?: string | null
): Promise<void> {
  await gasPost(
    {
      action: "saveSettings",
      tenant_id: tenantId,
      settings: settingsObj,
    },
    { authToken }
  );
}

function getBookedDates(roomName: string) {
  // TODO: Підключити Supabase пізніше
  const data: unknown[][] = [];
  const disabledDates: string[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[];
    const rName = row[3];
    const status = row[4];
    if ((rName === roomName || roomName === "all") && status !== "Скасовано") {
      const startD = new Date(String(row[1]));
      const endD = new Date(String(row[2]));
      while (startD < endD) {
        disabledDates.push(formatDateKyiv(startD, "yyyy-MM-dd"));
        startD.setDate(startD.getDate() + 1);
      }
    }
  }
  return disabledDates;
}

function getRoomNameById(roomId: string) {
  // TODO: Підключити Supabase пізніше
  const data: unknown[][] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[];
    if (row[0] === roomId) return String(row[1]);
  }
  return roomId;
}

async function calculateBookingMath(
  checkIn: string,
  checkOut: string,
  roomName: string,
  guests: number,
  pets: string | boolean | undefined,
  tenantId: string,
  authToken?: string | null
) {
  const d1 = new Date(checkIn);
  const d2 = new Date(checkOut);
  let nights = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  if (nights < 1) nights = 1;

  const settings = await getSettings(tenantId, authToken);
  const roomsList = (settings.roomsList as Record<string, unknown>[]) || [];
  const customPrices = (settings.customPrices as Record<string, Record<string, number>>) || {};
  const discountsList = (settings.discountsList as Record<string, unknown>[]) || [];

  const isJunior = roomName.includes("JUNIOR") || roomName.includes("Номер 1");
  let roomConfig = roomsList.find(
    (r) =>
      roomName.includes(String(r.name)) ||
      roomName.includes(String(r.short)) ||
      String(r.name).includes(roomName)
  ) as Record<string, number> | undefined;
  if (!roomConfig) {
    roomConfig = {
      id: isJunior ? 1 : 2,
      capacity: isJunior ? 2 : 4,
      priceWeekday: isJunior ? 4000 : 6500,
      priceWeekend: isJunior ? 5000 : 7500,
      extraGuestPrice: 2500,
    };
  }

  let roomBasePriceTotal = 0;
  const nightlyBasePrices: number[] = [];
  for (let i = 0; i < nights; i++) {
    const curr = new Date(d1);
    curr.setDate(curr.getDate() + i);
    const dateStr = formatDateKyiv(curr, "yyyy-MM-dd");
    const day = new Date(curr.toLocaleString("en-US", { timeZone: "Europe/Kyiv" })).getDay();
    const isWeekend = day === 0 || day === 5 || day === 6;
    let dayPrice = isWeekend ? roomConfig.priceWeekend : roomConfig.priceWeekday;
    if (nights === 1) {
      const one = Number(
        isWeekend ? roomConfig.priceOneNightWeekend : roomConfig.priceOneNightWeekday
      );
      if (Number.isFinite(one) && one > 0) dayPrice = one;
    }
    const cp = customPrices[String(roomConfig.id)];
    if (cp?.[dateStr]) dayPrice = cp[dateStr];
    dayPrice = Math.max(0, Math.round(Number(dayPrice) || 0));
    nightlyBasePrices.push(dayPrice);
    roomBasePriceTotal += dayPrice;
  }

  const extraGuests = Math.max(0, guests - (roomConfig.capacity || 2));
  const dynamicExtraPrice =
    roomConfig.extraGuestPrice !== undefined ? roomConfig.extraGuestPrice : 2500;
  const extraGuestFee = extraGuests * dynamicExtraPrice * nights;

  let discountPercent = 0;
  if (discountsList?.length) {
    for (const disc of discountsList) {
      const condNights = parseInt(String(disc.condition).replace(/\D/g, "")) || 0;
      const dPct = parseInt(String(disc.discount).replace(/\D/g, "")) / 100;
      if (nights >= condNights) {
        const roomsIds = disc.roomsIds as string[] | undefined;
        const appliesToRoom =
          (roomsIds &&
            (roomsIds.includes("all") || roomsIds.includes(String(roomConfig.id)))) ||
          (!roomsIds && String(disc.rooms).includes("Всі"));
        if (appliesToRoom && dPct > discountPercent) discountPercent = dPct;
      }
    }
  }

  const amountToDiscount = roomBasePriceTotal + extraGuestFee;
  const discountAmount = Math.round(amountToDiscount * discountPercent);
  const petFee = pets === "Так" || pets === true ? 500 + 200 * nights : 0;
  const totalExtraFees = extraGuestFee + petFee;
  const totalPrice = amountToDiscount - discountAmount + petFee;
  const branding = (settings.branding || {}) as Record<string, unknown>;
  const prepayment = calculatePrepaymentAmount(readPrepaymentPolicy(branding), {
    totalPrice,
    basePriceTotal: roomBasePriceTotal,
    nights,
    nightlyBasePrices,
  });

  return {
    nights,
    basePrice: roomBasePriceTotal,
    discountAmount,
    extraFees: totalExtraFees,
    totalPrice,
    prepayment,
    extraGuestFee,
    petFee,
  };
}

function generateIcalFeed(roomName: string) {
  // TODO: Підключити Supabase пізніше
  const data: unknown[][] = [];
  const ical: string[] = [];
  ical.push("BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BOSO Booking System//UK", "CALSCALE:GREGORIAN", "METHOD:PUBLISH");

  function formatDateIcal(dateObj: Date) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  }

  const nowStamp = formatDateIcal(new Date()) + "T090000Z";

  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[];
    const bId = String(row[0] || "").trim();
    const bRoom = String(row[3] || "").trim();
    const bStatus = String(row[4] || "").trim();
    if (!bId || !bRoom) continue;
    if (bStatus.toLowerCase().includes("скас")) continue;
    if (bRoom.toLowerCase().indexOf(roomName.toLowerCase()) === -1) continue;

    let checkInDate = row[1] instanceof Date ? row[1] : new Date(String(row[1]));
    let checkOutDate = row[2] instanceof Date ? row[2] : new Date(String(row[2]));
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) continue;

    const dtStart = formatDateIcal(checkInDate);
    const dtEnd = formatDateIcal(checkOutDate);
    const cleanUid = bId.replace(/\s+/g, "_") + "_" + i + "@bosohouses.com";
    ical.push(
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:" + dtStart,
      "DTEND;VALUE=DATE:" + dtEnd,
      "UID:" + cleanUid,
      "DTSTAMP:" + nowStamp,
      "SUMMARY:Бронь " + roomName,
      "END:VEVENT"
    );
  }
  ical.push("END:VCALENDAR");
  return ical.join("\r\n");
}

async function syncFromHutshub() {
  // TODO: Підключити Supabase пізніше
  const existingUIDs: string[] = [];
  for (const roomName in HUTSHUB_URLS) {
    const url = HUTSHUB_URLS[roomName];
    if (!url || url.includes("ТУТ_ПОСИЛАННЯ")) continue;
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const icalText = await response.text();
      const events = parseICal(icalText);
      for (const ev of events) {
        if (!ev.uid) continue;
        const safeUid = "H-" + ev.uid.replace(/[^a-zA-Z0-9]/g, "").substring(0, 12);
        if (existingUIDs.includes(safeUid)) continue;
        if (ev.uid.includes("@bosohouses.com")) continue;
        // TODO: Підключити Supabase пізніше — appendRow
        existingUIDs.push(safeUid);
        await notifyHutshubBookingCreated(roomName, ev.start!, ev.end!, safeUid);
      }
    } catch (err) {
      console.log(`Помилка синхронізації ${roomName}:`, err);
    }
  }
}

function parseICal(icalText: string) {
  const lines = icalText.split(/\r?\n/);
  const events: { start?: string; end?: string; uid?: string }[] = [];
  let currentEvent: { start?: string; end?: string; uid?: string } | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") currentEvent = {};
    else if (line === "END:VEVENT") {
      if (currentEvent?.start && currentEvent.end && currentEvent.uid) events.push(currentEvent);
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith("DTSTART"))
        currentEvent.start = parseICalDateToISO(line.split(":")[1].trim());
      else if (line.startsWith("DTEND"))
        currentEvent.end = parseICalDateToISO(line.split(":")[1].trim());
      else if (line.startsWith("UID:")) currentEvent.uid = line.substring(4).trim();
    }
  }
  return events;
}

function parseICalDateToISO(dateStr: string) {
  if (dateStr?.length >= 8) {
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  }
  return dateStr;
}

function cancelUnpaidBookings() {
  // TODO: Підключити Supabase пізніше
  const data: unknown[][] = [];
  const currentTime = Date.now();
  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[];
    const status = row[4];
    const paidAmount = Number(row[14]) || 0;
    const id = row[0];
    const isUnpaidSiteBooking = status === "Нова бронь" || status === "Очікує оплату";
    if (isUnpaidSiteBooking && paidAmount === 0 && id && String(id).indexOf("B-") === 0) {
      const timestamp = parseInt(String(id).split("-")[1]);
      if (timestamp) {
        const diffMins = (currentTime - timestamp) / (1000 * 60);
        if (diffMins >= 15) {
          // sheet.getRange(i + 1, 5).setValue("Скасовано");
        }
      }
    }
  }
}

async function triggerSmartSenderEvent(
  phone: string,
  eventName: string,
  customVariables?: Record<string, unknown>
) {
  const headers = {
    Authorization: "Bearer " + ssApiKey,
    "Content-Type": "application/json",
  };
  const phoneClean = String(phone).replace(/\D/g, "");
  const phone9 = phoneClean.slice(-9);
  if (phone9.length < 9) {
    console.log("⚠️ Номер надто короткий:", phone);
    return;
  }
  let contactId: string | null = null;
  try {
    const searchUrl = `https://api.smartsender.com/v1/contacts?page=1&limitation=20&term=${phone9}`;
    const response = await fetch(searchUrl, { headers });
    if (response.ok) {
      const result = (await response.json()) as {
        collection?: { id: string; phone?: string }[];
      };
      if (result.collection?.length) {
        for (const c of result.collection) {
          const cPhone = String(c.phone || "").replace(/\D/g, "");
          if (cPhone.includes(phone9)) {
            contactId = c.id;
            break;
          }
        }
      }
    }
  } catch (e) {
    console.log("Помилка пошуку в SmartSender:", e);
  }
  if (!contactId) return;
  if (customVariables && Object.keys(customVariables).length > 0) {
    try {
      await fetch(`https://api.smartsender.com/v1/contacts/${contactId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ values: customVariables }),
      });
    } catch (e) {
      console.log("Помилка оновлення змінних:", e);
    }
  }
  try {
    await fetch(`https://api.smartsender.com/v1/contacts/${contactId}/fire`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: eventName }),
    });
  } catch (e) {
    console.log("Помилка запуску тригера:", e);
  }
}

async function checkFlexibleGuestNotifications() {
  const now = new Date();
  const currentHour = now.getHours();
  const todayString = formatDateKyiv(now, "yyyy-MM-dd");
  // TODO: Підключити Supabase пізніше
  const data: unknown[][] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[];
    const status = String(row[4] || "").toLowerCase();
    if (status.includes("скас") || status.includes("нов")) continue;
    const checkIn = formatDateKyiv(new Date(String(row[1])), "yyyy-MM-dd");
    const checkOut = formatDateKyiv(new Date(String(row[2])), "yyyy-MM-dd");
    const roomName = String(row[3] || "Котедж");
    const clientPhone = String(row[6] || "").replace(/\D/g, "");
    const originalComment = String(row[18] || "");
    if (!clientPhone || clientPhone === "не вказано") continue;
    if (checkIn === todayString) {
      const matchEarly = originalComment.match(/🕒 Ранній заїзд: з (\d{2}):\d{2}/);
      let targetArrivalHour = 12;
      if (matchEarly) targetArrivalHour = parseInt(matchEarly[1]) - 2;
      if (currentHour === targetArrivalHour) {
        await triggerSmartSenderEvent(clientPhone, "arrival_today", { cottage_name: roomName });
      }
    }
    if (checkOut === todayString) {
      const matchLate = originalComment.match(/🕒 Пізній виїзд: до (\d{2}):\d{2}/);
      let targetCheckoutHour = 9;
      if (matchLate) targetCheckoutHour = parseInt(matchLate[1]) - 2;
      if (currentHour === targetCheckoutHour) {
        await triggerSmartSenderEvent(clientPhone, "checkout_today", { cottage_name: roomName });
      }
    }
  }
}

function getAdminOpsTargets() {
  if (TG_CONFIG.isTestMode) return { chatId: TG_CONFIG.testChatId, threadId: null as number | null };
  return { chatId: TG_CONFIG.adminGroupId, threadId: TG_CONFIG.adminOpsThreadId };
}

function getAdminFinanceTargets() {
  if (TG_CONFIG.isTestMode) return { chatId: TG_CONFIG.testChatId, threadId: null as number | null };
  return { chatId: TG_CONFIG.adminGroupId, threadId: TG_CONFIG.adminFinanceThreadId };
}

function getCleaningTargets() {
  if (TG_CONFIG.isTestMode) return { chatId: TG_CONFIG.testChatId, threadId: null as number | null };
  return { chatId: TG_CONFIG.cleaningGroupId, threadId: null };
}

async function sendTgMessage(
  text: string,
  keyboard?: unknown,
  chatId?: string,
  threadId?: number | null
) {
  const ops = getAdminOpsTargets();
  const cid = chatId || ops.chatId;
  let tid = threadId;
  if (tid === undefined) tid = ops.threadId;
  const payload: Record<string, unknown> = {
    chat_id: cid,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (tid) payload.message_thread_id = tid;
  if (keyboard) payload.reply_markup = JSON.stringify(keyboard);
  return fetch(`https://api.telegram.org/bot${TG_CONFIG.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function sendTgPhoto(
  base64: string,
  caption: string,
  keyboard?: unknown,
  chatId?: string,
  threadId?: number | null
) {
  const ops = getAdminOpsTargets();
  const cid = chatId || ops.chatId;
  let tid = threadId;
  if (tid === undefined) tid = ops.threadId;
  const raw = String(base64).split(",")[1] || String(base64);
  const buffer = Buffer.from(raw, "base64");
  const mime = String(base64).includes("data:image/png") ? "image/png" : "image/jpeg";
  const ext = mime === "image/png" ? "png" : "jpg";
  const blob = new Blob([buffer], { type: mime });
  const form = new FormData();
  form.append("chat_id", cid);
  form.append("photo", blob, `booking_card.${ext}`);
  if (caption) {
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
  }
  if (tid) form.append("message_thread_id", String(tid));
  if (keyboard) form.append("reply_markup", JSON.stringify(keyboard));
  return fetch(`https://api.telegram.org/bot${TG_CONFIG.botToken}/sendPhoto`, {
    method: "POST",
    body: form,
  });
}

async function sendTgPhotoUrl(
  photoUrl: string,
  caption: string,
  keyboard?: unknown,
  chatId?: string,
  threadId?: number | null
) {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: "HTML",
  };
  if (threadId) payload.message_thread_id = threadId;
  if (keyboard) payload.reply_markup = JSON.stringify(keyboard);
  return fetch(`https://api.telegram.org/bot${TG_CONFIG.botToken}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function notifyNewBookingCreated(
  bookingData: BookingNotifyData,
  mathData: { totalPrice?: number },
  _orderId?: string
) {
  const totalPrice = Number(bookingData.totalPrice) || mathData.totalPrice || 0;
  const paidAmount = Number(bookingData.paidAmount) || 0;
  const balance = totalPrice - paidAmount;
  let phone = String(bookingData.phone || "").replace(/\D/g, "");
  if (phone.length === 9) phone = "380" + phone;
  if (phone.length === 10 && phone.startsWith("0")) phone = "38" + phone;
  if (phone) phone = "+" + phone;

  const months = [
    "січня", "лютого", "березня", "квітня", "травня", "червня",
    "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
  ];
  function formatD(dStr: string) {
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return d.getDate() + " " + months[d.getMonth()];
    } catch {
      return dStr;
    }
  }
  const textDates = formatD(bookingData.checkIn) + " — " + formatD(bookingData.checkOut);
  const balanceLine =
    balance <= 0
      ? "✅ <b>Оплачено повністю</b>"
      : "⚠️ Залишок: <b>" + balance + " ₴</b>";

  const adminCaption =
    "🛎 <b>Нове бронювання</b> | " +
    (bookingData.source || "Адмінка") +
    "\n\n🏡 <b>" +
    bookingData.cottage +
    "</b>\n👤 " +
    (bookingData.name || "Гість") +
    " (" +
    phone +
    ")\n📅 " +
    textDates +
    "\n\n💰 Загальна сума: <b>" +
    totalPrice +
    " ₴</b>\n💳 Внесено аванс: <b>" +
    paidAmount +
    " ₴</b>\n" +
    balanceLine;

  const originalComment = bookingData.comment || "";
  const hasChan = originalComment.includes("♨️ Чан: Так") ? "Так" : "Ні";
  const matchEarly = originalComment.match(/🕒 Ранній заїзд: з (\d{2}:\d{2})/);
  const earlyTime = matchEarly ? matchEarly[1] : null;
  const matchLate = originalComment.match(/🕒 Пізній виїзд: до (\d{2}:\d{2})/);
  const lateTime = matchLate ? matchLate[1] : null;
  const cleanComment = originalComment
    .replace(/👥 Денні гості[^|]+(\|\s*)?/g, "")
    .replace(/♨️ Чан: Так\s*(\|\s*)?/g, "")
    .replace(/🇺🇦 УБД: Так\s*(\|\s*)?/g, "")
    .replace(/🕒 Ранній заїзд: з \d{2}:\d{2}(\s*\|\s*)?/g, "")
    .replace(/🕒 Пізній виїзд: до \d{2}:\d{2}(\s*\|\s*)?/g, "")
    .replace(/Коментар гостя:/gi, "")
    .replace(/^[|\s]+|[|\s]+$/g, "")
    .trim();

  let cleaningDetails = "👥 " + (bookingData.guests || 2) + " осіб\n🐾 З твариною: " + (bookingData.pets || "Ні") + "\n";
  if (hasChan === "Так") cleaningDetails += "♨️ Чан: Так\n";
  if (earlyTime) cleaningDetails += "🕒 Ранній заїзд: з " + earlyTime + "\n";
  if (lateTime) cleaningDetails += "🕒 Пізній виїзд: до " + lateTime + "\n";
  if (cleanComment && cleanComment !== "Немає")
    cleaningDetails += '💬 Коментар: "' + cleanComment + '"\n';

  const cleaningCaptionFull =
    "🛎 <b>Нове бронювання | " + bookingData.cottage + "</b>\n\n📅 " + textDates + "\n\n<b>Деталі:</b>\n" + cleaningDetails;
  const cleaningCaptionShort = "🛎 <b>Нове бронювання | " + bookingData.cottage + "</b>\n📅 " + textDates;

  const adminTargets = getAdminOpsTargets();
  const cleaningTargets = getCleaningTargets();
  const adminKeyboard = {
    inline_keyboard: [[{ text: "📅 Шахматка", url: "https://t.me/bosohouses_bot/boso" }]],
  };

  if (bookingData.screenshot) {
    await sendTgPhoto(
      bookingData.screenshot,
      adminCaption,
      adminKeyboard,
      adminTargets.chatId,
      adminTargets.threadId
    );
  } else {
    await sendTgMessage(adminCaption, adminKeyboard, adminTargets.chatId, adminTargets.threadId);
  }
  if (bookingData.screenshotCleaning) {
    await sendTgPhoto(
      bookingData.screenshotCleaning,
      cleaningCaptionShort,
      null,
      cleaningTargets.chatId,
      cleaningTargets.threadId
    );
  } else {
    await sendTgMessage(cleaningCaptionFull, null, cleaningTargets.chatId, cleaningTargets.threadId);
  }
}

async function notifyPaymentReceived(
  bookingData: Record<string, unknown>,
  paymentInfo: { amount: number; method?: string }
) {
  const amount = Number(paymentInfo.amount) || 0;
  if (amount <= 0) return;
  const totalPrice = Number(bookingData.totalPrice) || 0;
  const paidAmount = Number(bookingData.paidAmount) || 0;
  const balance = totalPrice - paidAmount;
  const method = paymentInfo.method || "Готівка";
  let phone = String(bookingData.phone || "").replace(/\D/g, "");
  if (phone.length === 9) phone = "380" + phone;
  if (phone.length === 10 && phone.startsWith("0")) phone = "38" + phone;
  if (phone) phone = "+" + phone;

  const months = [
    "січня", "лютого", "березня", "квітня", "травня", "червня",
    "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
  ];
  function formatD(dStr: string) {
    const d = new Date(String(dStr));
    if (isNaN(d.getTime())) return String(dStr);
    return d.getDate() + " " + months[d.getMonth()];
  }
  function formatMoney(n: number) {
    if (isNaN(n) || n === null) return "0 ₴";
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₴";
  }
  const balanceLine =
    balance <= 0 ? "✅ <b>Оплачено повністю</b>" : "⚠️ Залишок: <b>" + formatMoney(balance) + "</b>";
  const caption =
    balanceLine +
    "\n🏡 <b>" +
    (bookingData.cottage || "Котедж") +
    "</b>\n📅 " +
    formatD(String(bookingData.checkIn)) +
    " — " +
    formatD(String(bookingData.checkOut));
  const adminKeyboard = {
    inline_keyboard: [[{ text: "📅 Шахматка", url: "https://t.me/bosohouses_bot/boso" }]],
  };
  const financeTargets = getAdminFinanceTargets();
  if (bookingData.screenshotPayment) {
    await sendTgPhoto(
      String(bookingData.screenshotPayment),
      caption,
      adminKeyboard,
      financeTargets.chatId,
      financeTargets.threadId
    );
  } else {
    await sendTgMessage(
      caption +
        "\n\n👤 " +
        (bookingData.name || "Гість") +
        (phone ? " (" + phone + ")" : "") +
        "\n💵 Доплата: <b>" +
        formatMoney(amount) +
        "</b> (<b>" +
        method +
        "</b>)\n💰 Загальна сума: <b>" +
        formatMoney(totalPrice) +
        "</b>\n💳 Всього внесено: <b>" +
        formatMoney(paidAmount) +
        "</b>",
      adminKeyboard,
      financeTargets.chatId,
      financeTargets.threadId
    );
  }
}

async function notifyHutshubBookingCreated(
  roomName: string,
  checkIn: string,
  checkOut: string,
  _safeUid: string
) {
  const hutshubPhoto = "https://imgpx.com/A7eOBs4Em8y6.png";
  const months = [
    "січня", "лютого", "березня", "квітня", "травня", "червня",
    "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
  ];
  function formatTextDate(dStr: string) {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.getDate() + " " + months[d.getMonth()];
  }
  const textDates = formatTextDate(checkIn) + " — " + formatTextDate(checkOut);
  const adminCaption =
    "🛎 <b>Нове бронювання</b> | HUTSHUB\n\n🏡 <b>" +
    roomName +
    "</b>\n👤 Гість Hutshub\n📅 " +
    textDates +
    "\n\n💰 Загальна сума: <b>Оплата на платформі</b>\n💳 Внесено аванс: <b>Оплата на платформі</b>\n✅ <b>Підтверджено</b>";
  const cleaningCaption = "🛎 <b>Нове бронювання | " + roomName + "</b>\n\n📅 " + textDates + "\n\n";
  const adminTargets = getAdminOpsTargets();
  const cleaningTargets = getCleaningTargets();
  const adminKeyboard = {
    inline_keyboard: [[{ text: "📅 Шахматка", url: "https://t.me/bosohouses_bot/boso" }]],
  };
  await sendTgPhotoUrl(hutshubPhoto, adminCaption, adminKeyboard, adminTargets.chatId, adminTargets.threadId);
  await sendTgPhotoUrl(hutshubPhoto, cleaningCaption, null, cleaningTargets.chatId, cleaningTargets.threadId);
}

async function checkTodayBookings() {
  const todayString = formatDateKyiv(new Date(), "yyyy-MM-dd");
  // TODO: Підключити Supabase пізніше
  const data: unknown[][] = [];
  const arrivalPhoto = "https://imgpx.com/J3dXlnqB0Jea.png";
  const checkoutPhoto = "https://imgpx.com/et8EBt4MryDH.png";

  function formatMoney(amount: number) {
    if (isNaN(amount) || amount === null) return "0 ₴";
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₴";
  }

  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[];
    const status = String(row[4] || "").toLowerCase();
    if (status.includes("скас") || status.includes("нов")) continue;
    const checkIn = formatDateKyiv(new Date(String(row[1])), "yyyy-MM-dd");
    const checkOut = formatDateKyiv(new Date(String(row[2])), "yyyy-MM-dd");
    const isArrivalToday = checkIn === todayString;
    const isDepartureToday = checkOut === todayString;
    if (!isArrivalToday && !isDepartureToday) continue;

    const roomName = String(row[3] || "Котедж");
    const clientName = String(row[5] || "Гість").replace(" (Ручна бронь)", "");
    let clientPhone = String(row[6] || "").replace(/\D/g, "");
    if (clientPhone.length === 9) clientPhone = "380" + clientPhone;
    if (clientPhone.length === 10 && clientPhone.startsWith("0")) clientPhone = "38" + clientPhone;
    const guestsCount = row[7] || 2;
    const petsRaw = row[8] || "Ні";
    const hasPet = petsRaw === "Так" || petsRaw === true ? "Так" : "Ні";
    const totalPrice = Number(row[13]) || 0;
    const paidAmount = Number(row[14]) || 0;
    const balance = totalPrice - paidAmount;
    const originalComment = String(row[18] || "");
    const months = [
      "січня", "лютого", "березня", "квітня", "травня", "червня",
      "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
    ];
    function formatTextDate(dStr: string) {
      const d = new Date(dStr);
      return d.getDate() + " " + months[d.getMonth()];
    }
    const textDates = formatTextDate(String(row[1])) + " — " + formatTextDate(String(row[2]));
    const hasChan = originalComment.includes("♨️ Чан: Так") ? "Так" : "Ні";
    const hasUbd = originalComment.includes("🇺🇦 УБД: Так") ? "Так" : "Ні";
    const matchEarly = originalComment.match(/🕒 Ранній заїзд: з (\d{2}:\d{2})/);
    const earlyTime = matchEarly ? matchEarly[1] : null;
    const matchLate = originalComment.match(/🕒 Пізній виїзд: до (\d{2}:\d{2})/);
    const lateTime = matchLate ? matchLate[1] : null;
    const cleanComment = originalComment
      .replace(/👥 Денні гості[^|]+(\|\s*)?/g, "")
      .replace(/♨️ Чан: Так\s*(\|\s*)?/g, "")
      .replace(/🇺🇦 УБД: Так\s*(\|\s*)?/g, "")
      .replace(/🕒 Ранній заїзд: з \d{2}:\d{2}(\s*\|\s*)?/g, "")
      .replace(/🕒 Пізній виїзд: до \d{2}:\d{2}(\s*\|\s*)?/g, "")
      .replace(/Коментар гостя:/gi, "")
      .replace(/^[|\s]+|[|\s]+$/g, "")
      .trim();
    const balanceLine =
      balance <= 0
        ? "✅ <b>Оплачено повністю</b>"
        : "⚠️ Залишок до сплати: <b>" + formatMoney(balance) + "</b>";
    const adminTargets = getAdminOpsTargets();
    const cleaningTargets = getCleaningTargets();
    const adminKeyboard = {
      inline_keyboard: [[{ text: "📅 Шахматка", url: "https://t.me/bosohouses_bot/boso" }]],
    };

    if (isArrivalToday) {
      let cleanArrDetails = "👥 " + guestsCount + " осіб\n";
      if (hasPet === "Так") cleanArrDetails += "🐾 З твариною\n";
      if (hasChan === "Так") cleanArrDetails += "♨️ Чан: Так\n";
      if (earlyTime) cleanArrDetails += "🕒 Ранній заїзд: з " + earlyTime + "\n";
      if (cleanComment && cleanComment !== "Немає")
        cleanArrDetails += '💬 Коментар: "' + cleanComment + '"\n';
      let adminArrDetails = "👥 " + guestsCount + " осіб\n";
      if (hasPet === "Так") adminArrDetails += "🐾 З твариною\n";
      if (hasChan === "Так") adminArrDetails += "♨️ Чан: Так\n";
      if (hasUbd === "Так") adminArrDetails += "🇺🇦 УБД: Так\n";
      if (earlyTime) adminArrDetails += "🕒 Ранній заїзд: з " + earlyTime + "\n";
      if (cleanComment && cleanComment !== "Немає")
        adminArrDetails += '💬 Коментар: "' + cleanComment + '"\n';
      const adminArrCaption =
        "🛎 <b>СЬОГОДНІ ЗАЇЗД | " + roomName + "</b>\n\n👤 " + clientName + " (+" + clientPhone + ")\n📅 " + textDates + "\n\n<b>Деталі:</b>\n" + adminArrDetails + "\n💰 Загальна сума: <b>" + formatMoney(totalPrice) + "</b>\n✅ Внесено аванс: <b>" + formatMoney(paidAmount) + "</b>\n" + balanceLine;
      const cleanArrCaption =
        "🛎 <b>СЬОГОДНІ ЗАЇЗД | " + roomName + "</b>\n\n📅 " + textDates + "\n\n<b>Деталі:</b>\n" + cleanArrDetails;
      await sendTgPhotoUrl(arrivalPhoto, adminArrCaption, adminKeyboard, adminTargets.chatId, adminTargets.threadId);
      await sendTgPhotoUrl(arrivalPhoto, cleanArrCaption, null, cleaningTargets.chatId, cleaningTargets.threadId);
    }
    if (isDepartureToday) {
      let cleanDepDetails = "👥 Було " + guestsCount + " осіб\n";
      if (hasPet === "Так") cleanDepDetails += "🐾 Була тварина\n";
      if (hasChan === "Так") cleanDepDetails += "♨️ Був чан\n";
      if (lateTime) cleanDepDetails += "🕒 Пізній виїзд: до " + lateTime + "\n";
      if (cleanComment && cleanComment !== "Немає")
        cleanDepDetails += '💬 Коментар: "' + cleanComment + '"\n';
      let adminDepDetails = "👥 Було " + guestsCount + " осіб\n";
      if (hasPet === "Так") adminDepDetails += "🐾 Була тварина\n";
      if (hasChan === "Так") adminDepDetails += "♨️ Був чан\n";
      if (hasUbd === "Так") adminDepDetails += "🇺🇦 УБД: Так\n";
      if (lateTime) adminDepDetails += "🕒 Пізній виїзд: до " + lateTime + "\n";
      if (cleanComment && cleanComment !== "Немає")
        adminDepDetails += '💬 Коментар: "' + cleanComment + '"\n';
      const adminDepCaption =
        "🛎 <b>СЬОГОДНІ ВИЇЗД | " + roomName + "</b>\n\n👤 " + clientName + " (+" + clientPhone + ")\n📅 " + textDates + "\n\n<b>Деталі:</b>\n" + adminDepDetails + "\n💰 Загальна сума: <b>" + formatMoney(totalPrice) + "</b>\n✅ Внесено аванс: <b>" + formatMoney(paidAmount) + "</b>\n" + balanceLine;
      const cleanDepCaption =
        "🛎 <b>СЬОГОДНІ ВИЇЗД | " + roomName + "</b>\n\n📅 " + textDates + "\n\n<b>Деталі:</b>\n" + cleanDepDetails;
      await sendTgPhotoUrl(checkoutPhoto, adminDepCaption, adminKeyboard, adminTargets.chatId, adminTargets.threadId);
      await sendTgPhotoUrl(checkoutPhoto, cleanDepCaption, null, cleaningTargets.chatId, cleaningTargets.threadId);
    }
  }
}

function tgFormatMoneyAmount(amount: number) {
  const n = Math.round(Number(amount) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function tgAddPaymentByMethod(
  totals: { cash: number; card: number; fop: number },
  amount: number,
  method: string
) {
  const amt = Math.round(Number(amount) || 0);
  if (amt <= 0) return;
  const m = String(method || "").trim();
  if (m === "Готівка") totals.cash += amt;
  else if (m === "Картка") totals.card += amt;
  else totals.fop += amt;
}

function tgCollectPaymentsFromRow(row: unknown[], totals: { cash: number; card: number; fop: number }) {
  const paidAmount = Number(row[14]) || 0;
  const prepayAmt = Number(row[25]) || 0;
  const prepayMethod = String(row[26] || "ФОП");
  const surchargeAmt = Number(row[27]) || 0;
  const surchargeMethod = String(row[28] || "Готівка");
  if (prepayAmt > 0 || surchargeAmt > 0) {
    tgAddPaymentByMethod(totals, prepayAmt, prepayMethod);
    tgAddPaymentByMethod(totals, surchargeAmt, surchargeMethod);
  } else if (paidAmount > 0) {
    tgAddPaymentByMethod(totals, paidAmount, prepayMethod);
  }
}

function addDaysKyiv(dateStr: string, days: number) {
  const parts = dateStr.split("-");
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  d.setDate(d.getDate() + days);
  return formatDateKyiv(d, "yyyy-MM-dd");
}

function getKyivWeekRange(referenceDate?: Date) {
  const ref = referenceDate || new Date();
  const todayStr = formatDateKyiv(ref, "yyyy-MM-dd");
  const isoDay = Number(formatDateKyiv(ref, "u"));
  const startStr = addDaysKyiv(todayStr, -(isoDay - 1));
  return { start: startStr, end: addDaysKyiv(startStr, 6) };
}

function getKyivMonthRange(referenceDate?: Date) {
  const ref = referenceDate || new Date();
  const y = formatDateKyiv(ref, "yyyy");
  const m = formatDateKyiv(ref, "MM");
  const lastDayNum = new Date(Number(y), Number(m), 0).getDate();
  const dStr = lastDayNum < 10 ? "0" + lastDayNum : String(lastDayNum);
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${dStr}`, year: y, month: m };
}

function isSundayKyiv(d?: Date) {
  return Number(formatDateKyiv(d || new Date(), "u")) === 7;
}

function isLastDayOfMonthKyiv(d?: Date) {
  const ref = d || new Date();
  const range = getKyivMonthRange(ref);
  return formatDateKyiv(ref, "yyyy-MM-dd") === range.end;
}

function formatPeriodLabelUk(startStr: string, endStr: string) {
  const fmt = (s: string) => {
    const p = s.split("-");
    return p[2] + "." + p[1] + "." + p[0];
  };
  return fmt(startStr) + " — " + fmt(endStr);
}

function formatMonthLabelUk(year: string, month: string) {
  const months = [
    "січень", "лютий", "березень", "квітень", "травень", "червень",
    "липень", "серпень", "вересень", "жовтень", "листопад", "грудень",
  ];
  return months[Number(month) - 1] + " " + year;
}

function getKyivPrevMonthRange() {
  const todayStr = formatDateKyiv(new Date(), "yyyy-MM-dd");
  const p = todayStr.split("-");
  let y = Number(p[0]);
  let m = Number(p[1]) - 1;
  if (m < 1) {
    m = 12;
    y--;
  }
  return getKyivMonthRange(new Date(y, m - 1, 15));
}

function resolveReportPeriodRange(
  period: string,
  customStart: string,
  customEnd: string,
  periodLabel: string
) {
  const now = new Date();
  if (period === "custom" && customStart && customEnd) {
    const start = formatBookingDateKyiv(customStart) || customStart.trim();
    const end = formatBookingDateKyiv(customEnd) || customEnd.trim();
    return { start, end, label: periodLabel || formatPeriodLabelUk(start, end) };
  }
  if (period === "prev") {
    const prevR = getKyivPrevMonthRange();
    return {
      start: prevR.start,
      end: prevR.end,
      label: periodLabel || formatMonthLabelUk(prevR.year, prevR.month),
    };
  }
  if (period === "year") {
    const y = formatDateKyiv(now, "yyyy");
    return { start: y + "-01-01", end: y + "-12-31", label: periodLabel || "За " + y + " рік" };
  }
  if (period === "all") {
    return { start: "2000-01-01", end: "2100-12-31", label: periodLabel || "За весь час" };
  }
  const curR = getKyivMonthRange(now);
  return {
    start: curR.start,
    end: curR.end,
    label: periodLabel || formatMonthLabelUk(curR.year, curR.month),
  };
}

function tgEscapeHtml(text: string) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatBookingDateKyiv(cellValue: unknown): string {
  if (!cellValue && cellValue !== 0) return "";
  if (cellValue instanceof Date && !isNaN(cellValue.getTime())) {
    return formatDateKyiv(cellValue, "yyyy-MM-dd");
  }
  const str = String(cellValue).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  try {
    const d = new Date(String(cellValue));
    if (!isNaN(d.getTime())) return formatDateKyiv(d, "yyyy-MM-dd");
  } catch {
    /* ignore */
  }
  return "";
}

function bookingToFinanceSheetRow(row: SupabaseBookingRow): unknown[] {
  const fd = parseFinanceData(row.finance_data);
  const a: unknown[] = [];
  a[0] = row.display_id;
  a[1] = row.check_in;
  a[4] = row.status;
  a[13] = fd.totalPrice;
  a[14] = fd.paidAmount;
  a[19] = fd.extraGuestFee;
  a[20] = fd.petFee;
  a[22] = fd.earlyFee;
  a[23] = fd.lateFee;
  a[25] = fd.prepayAmount;
  a[26] = fd.prepayMethod;
  a[27] = fd.surchargeAmount;
  a[28] = fd.surchargeMethod;
  return a;
}

async function calculateFinancePeriodDetailed(
  startStr: string,
  endStr: string,
  tenantId: string
) {
  const breakdown = { base: 0, guests: 0, pets: 0, earlyLate: 0 };
  const payments = { cash: 0, card: 0, fop: 0 };
  let bookingsCount = 0;
  let bookingIncome = 0;
  const manualIncomeLines: { title: string; amount: number; sub: string }[] = [];
  const expenseLines: { title: string; amount: number; sub: string }[] = [];
  let totalExpense = 0;

  const bookingRows = await loadTenantBookings(tenantId);

  for (const b of bookingRows) {
    if (!b.display_id) continue;
    if (String(b.status || "").toLowerCase().includes("скас")) continue;
    const checkIn = formatBookingDateKyiv(b.check_in);
    if (!checkIn || checkIn < startStr || checkIn > endStr) continue;
    bookingsCount++;
    const fd = parseFinanceData(b.finance_data);
    const paid = Number(fd.paidAmount) || 0;
    const price = Number(fd.totalPrice) || 0;
    if (paid > 0) {
      bookingIncome += paid;
      const row = bookingToFinanceSheetRow(b);
      tgCollectPaymentsFromRow(row, payments);
      const feeGuests =
        fd.extraGuestFee !== "" && fd.extraGuestFee !== undefined
          ? Number(fd.extraGuestFee)
          : 0;
      const feePets =
        fd.petFee !== "" && fd.petFee !== undefined ? Number(fd.petFee) : 0;
      const feeEarlyLate = (Number(fd.earlyFee) || 0) + (Number(fd.lateFee) || 0);
      const ratio = price > 0 ? paid / price : 1;
      breakdown.pets += Math.round(feePets * ratio);
      breakdown.guests += Math.round(feeGuests * ratio);
      breakdown.earlyLate += Math.round(feeEarlyLate * ratio);
      breakdown.base += Math.round(
        paid - feePets * ratio - feeGuests * ratio - feeEarlyLate * ratio
      );
    }
  }

  const incomeLines: { title: string; amount: number; sub: string }[] = [];
  if (breakdown.base > 0) incomeLines.push({ title: "Оренда котеджів", amount: breakdown.base, sub: "" });
  if (breakdown.guests > 0) incomeLines.push({ title: "Додаткові гості", amount: breakdown.guests, sub: "" });
  if (breakdown.pets > 0) incomeLines.push({ title: "Тварини", amount: breakdown.pets, sub: "" });
  if (breakdown.earlyLate > 0) incomeLines.push({ title: "Гнучкий графік", amount: breakdown.earlyLate, sub: "" });

  const settings = await getSettings(tenantId);
  const transactions = (settings.transactions as Record<string, unknown>[]) || [];
  for (const tr of transactions) {
    const tDate = formatBookingDateKyiv(tr.date);
    if (!tDate || tDate < startStr || tDate > endStr) continue;
    const amt = Math.round(Number(tr.amount) || 0);
    if (amt <= 0) continue;
    const title = String(tr.category || (tr.type === "income" ? "Дохід" : "Витрата"));
    const sub = tr.comment ? String(tr.comment).trim() : "";
    if (tr.type === "income") manualIncomeLines.push({ title, amount: amt, sub });
    else if (tr.type === "expense") {
      totalExpense += amt;
      expenseLines.push({ title, amount: amt, sub });
    }
  }
  for (const inc of manualIncomeLines) incomeLines.push(inc);
  let manualIncomeTotal = 0;
  for (const mi of manualIncomeLines) manualIncomeTotal += mi.amount;
  const totalIncome = bookingIncome + manualIncomeTotal;
  return {
    bookingsCount,
    totalIncome,
    totalExpense,
    profit: totalIncome - totalExpense,
    payments,
    incomeLines,
    expenseLines,
  };
}

async function calculateFinancePeriod(
  startStr: string,
  endStr: string,
  tenantId: string
) {
  const d = await calculateFinancePeriodDetailed(startStr, endStr, tenantId);
  return {
    bookingsCount: d.bookingsCount,
    totalIncome: d.totalIncome,
    totalExpense: d.totalExpense,
    profit: d.profit,
    payments: d.payments,
  };
}

async function sendFinanceReportTelegram(payload: {
  period: string;
  customStart: string;
  customEnd: string;
  periodLabel: string;
  screenshot: string;
}) {
  if (!payload.screenshot) return { success: false, error: "NO_SCREENSHOT" };
  const adminKeyboard = {
    inline_keyboard: [[{ text: "📅 Шахматка", url: "https://t.me/bosohouses_bot/boso" }]],
  };
  const targets = getAdminFinanceTargets();
  const tgResponse = await sendTgPhoto(
    payload.screenshot,
    "",
    adminKeyboard,
    targets.chatId,
    targets.threadId
  );
  try {
    const tgResult = (await tgResponse.json()) as { ok?: boolean; description?: string };
    if (!tgResult.ok) {
      return { success: false, error: "TELEGRAM", message: tgResult.description || "Telegram API error" };
    }
  } catch {
    return { success: false, error: "TELEGRAM_PARSE" };
  }
  return { success: true };
}

type FinancePeriodStats = Awaited<ReturnType<typeof calculateFinancePeriod>>;

function hasFinanceActivity(stats: FinancePeriodStats) {
  return stats.bookingsCount > 0 || stats.totalIncome > 0 || stats.totalExpense > 0;
}

function buildFinancePeriodCaption(
  titleEmoji: string,
  title: string,
  periodLabel: string,
  stats: FinancePeriodStats
) {
  return (
    titleEmoji +
    " <b>" +
    title +
    "</b>\n<i>" +
    periodLabel +
    "</i>\n\n📝 Заїздів: <b>" +
    stats.bookingsCount +
    "</b>\n💰 Дохід: <b>" +
    tgFormatMoneyAmount(stats.totalIncome) +
    " ₴</b>\n💵 Готівка: <b>" +
    tgFormatMoneyAmount(stats.payments.cash) +
    " ₴</b>\n💳 Картка: <b>" +
    tgFormatMoneyAmount(stats.payments.card) +
    " ₴</b>\n🏦 ФОП: <b>" +
    tgFormatMoneyAmount(stats.payments.fop) +
    " ₴</b>\n📉 Витрати: <b>" +
    tgFormatMoneyAmount(stats.totalExpense) +
    " ₴</b>\n✅ Чистий прибуток: <b>" +
    tgFormatMoneyAmount(stats.profit) +
    " ₴</b>"
  );
}

async function sendWeeklyFinanceSummary(forceRun?: boolean, tenantId?: string) {
  if (!tenantId) return;
  if (!forceRun && !isSundayKyiv()) return;
  const range = getKyivWeekRange();
  const stats = await calculateFinancePeriod(range.start, range.end, tenantId);
  if (!hasFinanceActivity(stats)) return;
  const caption = buildFinancePeriodCaption(
    "📊",
    "ТИЖНЕВЕ ЗВЕДЕННЯ",
    formatPeriodLabelUk(range.start, range.end),
    stats
  );
  const targets = getAdminFinanceTargets();
  await sendTgPhotoUrl(TG_PHOTOS.eveningKasa, caption, null, targets.chatId, targets.threadId);
}

async function sendMonthlyFinanceSummary(forceRun?: boolean, tenantId?: string) {
  if (!tenantId) return;
  if (!forceRun && !isLastDayOfMonthKyiv()) return;
  const range = getKyivMonthRange();
  const stats = await calculateFinancePeriod(range.start, range.end, tenantId);
  if (!hasFinanceActivity(stats)) return;
  const caption = buildFinancePeriodCaption(
    "📆",
    "МІСЯЧНЕ ЗВЕДЕННЯ",
    formatMonthLabelUk(range.year, range.month),
    stats
  );
  const targets = getAdminFinanceTargets();
  await sendTgPhotoUrl(TG_PHOTOS.eveningKasa, caption, null, targets.chatId, targets.threadId);
}

function isActiveBookingStatus(status: unknown) {
  const s = String(status || "").toLowerCase();
  return !s.includes("скас") && !s.includes("нов");
}

function getBookingCreatedDateString(row: unknown[]): string | null {
  const created = row[16];
  if (created) {
    const fromCol = formatBookingDateKyiv(created);
    if (fromCol) return fromCol;
  }
  const id = String(row[0] || "");
  const match = id.match(/^[AB]-(\d+)/i);
  if (match) return formatDateKyiv(new Date(Number(match[1])), "yyyy-MM-dd");
  return null;
}

async function sendEveningCashSummary() {
  const todayString = formatDateKyiv(new Date(), "yyyy-MM-dd");
  // TODO: Підключити Supabase пізніше
  const data: unknown[][] = [];
  let newBookingsCount = 0;
  const payments = { cash: 0, card: 0, fop: 0 };
  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[];
    if (!row[0]) continue;
    if (!isActiveBookingStatus(row[4])) continue;
    const createdOn = getBookingCreatedDateString(row);
    if (createdOn !== todayString) continue;
    newBookingsCount++;
    tgCollectPaymentsFromRow(row, payments);
  }
  const paymentsSum = payments.cash + payments.card + payments.fop;
  if (newBookingsCount === 0 && paymentsSum === 0) return;
  const caption =
    "🌙 <b>ВЕЧІРНЄ ЗВЕДЕННЯ</b>\n\n📝 Нових бронювань: <b>" +
    newBookingsCount +
    "</b>\n💰 Надійшло оплат: <b>" +
    tgFormatMoneyAmount(paymentsSum) +
    " ₴</b>\n💵 Готівка: <b>" +
    tgFormatMoneyAmount(payments.cash) +
    " ₴</b>\n💳 Картка: <b>" +
    tgFormatMoneyAmount(payments.card) +
    " ₴</b>\n🏦 ФОП: <b>" +
    tgFormatMoneyAmount(payments.fop) +
    " ₴</b>\n🗝 <i>Фінансовий день закрито</i>";
  const targets = getAdminFinanceTargets();
  await sendTgPhotoUrl(TG_PHOTOS.eveningKasa, caption, null, targets.chatId, targets.threadId);
}

async function sendDebtReminders() {
  const todayString = formatDateKyiv(new Date(), "yyyy-MM-dd");
  // TODO: Підключити Supabase пізніше
  const data: unknown[][] = [];
  const targets = getAdminFinanceTargets();
  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[];
    if (!row[0]) continue;
    if (!isActiveBookingStatus(row[4])) continue;
    const checkOut = formatBookingDateKyiv(row[2]);
    if (!checkOut || checkOut !== todayString) continue;
    const totalPrice = Number(row[13]) || 0;
    const paidAmount = Number(row[14]) || 0;
    const debt = totalPrice - paidAmount;
    if (debt <= 0) continue;
    const roomName = row[3] || "Котедж";
    const caption =
      "⚠️ <b>Увага: Неоплачений залишок</b>\n\n🏠 Котедж: <b>" +
      roomName +
      "</b>\n💳 Доплата: <b>" +
      tgFormatMoneyAmount(debt) +
      " ₴</b>";
    await sendTgPhotoUrl(TG_PHOTOS.debtReminder, caption, null, targets.chatId, targets.threadId);
  }
}

/** Cron / scheduled jobs — підключити через Vercel Cron або окремий route */
export {
  BOOKING_COL,
  cancelUnpaidBookings,
  syncFromHutshub,
  checkFlexibleGuestNotifications,
  checkTodayBookings,
  sendDebtReminders,
  sendEveningCashSummary,
  sendWeeklyFinanceSummary,
  sendMonthlyFinanceSummary,
  resolveReportPeriodRange,
  calculateFinancePeriodDetailed,
};
