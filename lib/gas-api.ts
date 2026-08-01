import type { AdminInitResponse } from "@/components/admin/desktop/types";
import type { PublicTenantPayload } from "@/lib/public-booking/types";

const GAS_URL = () => process.env.NEXT_PUBLIC_GAS_URL?.trim() || "";

export const GAS_AUTH_TOKEN_KEY = "gas_auth_token";

export type GasUser = {
  id: string;
  email?: string;
  name?: string;
};

export type GasSession = {
  user: GasUser;
  accessToken: string;
};

export type TenantMembership = {
  tenantId: string;
  role: string;
  tenantName: string | null;
  plan: string | null;
  displayName?: string | null;
  userId?: string | null;
  email?: string | null;
};

export type TeamMemberPublic = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin";
  active: boolean;
  createdAt?: string;
  hasPendingInvite?: boolean;
};

export type GasApiError = {
  error?: string;
  message?: string;
};

const GAS_FETCH_TIMEOUT_MS = 55_000;

function gasFetchSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(GAS_FETCH_TIMEOUT_MS);
  }
  return undefined;
}

function assertGasUrl(): string {
  const url = GAS_URL();
  if (!url) {
    throw new Error("NEXT_PUBLIC_GAS_URL is not configured");
  }
  return url;
}

/** Браузер → same-origin проксі (без CORS). Сервер → напряму на GAS. */
function getRequestBase(): string {
  if (typeof window !== "undefined") {
    return "/api/gas";
  }
  return assertGasUrl();
}

function buildUrl(params: Record<string, string | number | undefined>): string {
  const base = getRequestBase();

  if (base.startsWith("/")) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && String(value) !== "") {
        search.set(key, String(value));
      }
    }
    const qs = search.toString();
    return qs ? `${base}?${qs}` : base;
  }

  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function buildFetchUrl(
  params: Record<string, string | number | undefined>,
  authToken?: string | null
): string {
  const url = buildUrl(params);
  if (!authToken || url.startsWith("/")) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("token", authToken);
  return parsed.toString();
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`Empty response (HTTP ${res.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON (HTTP ${res.status})`);
  }
}

export async function gasFetch<T>(
  params: Record<string, string | number | undefined>,
  init?: RequestInit & { authToken?: string | null }
): Promise<T> {
  const { authToken, ...fetchInit } = init ?? {};
  const headers = new Headers(fetchInit.headers);
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }
  const tenantId = params.tenant_id ?? params.tenantId;
  if (tenantId) {
    headers.set("x-tenant-id", String(tenantId));
  }
  if (authToken) {
    headers.set("x-gas-token", authToken);
  }

  const res = await fetch(buildFetchUrl(params, authToken), {
    ...fetchInit,
    headers,
    cache: "no-store",
    redirect: "follow",
    signal: gasFetchSignal(),
  });

  const data = await parseJson<T & GasApiError>(res);
  if (!res.ok) {
    const msg =
      (data as GasApiError).message ||
      (data as GasApiError).error ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function gasPost<T>(
  body: Record<string, unknown>,
  init?: RequestInit & { authToken?: string | null }
): Promise<T> {
  const { authToken, ...fetchInit } = init ?? {};
  const headers = new Headers(fetchInit.headers);
  headers.set("Content-Type", "text/plain;charset=utf-8");
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }
  const tenantId = body.tenant_id ?? body.tenantId;
  if (tenantId) {
    headers.set("x-tenant-id", String(tenantId));
  }
  if (authToken) {
    headers.set("x-gas-token", authToken);
  }

  const payload = { ...body };
  if (authToken && payload.accessToken === undefined) {
    payload.accessToken = authToken;
  }

  const res = await fetch(getRequestBase(), {
    method: "POST",
    ...fetchInit,
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
    redirect: "follow",
    signal: gasFetchSignal(),
  });

  const data = await parseJson<T & GasApiError>(res);
  if (!res.ok) {
    const msg =
      (data as GasApiError).message ||
      (data as GasApiError).error ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// --- Auth (client-side token in localStorage) ---

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const fromLs = localStorage.getItem(GAS_AUTH_TOKEN_KEY);
  if (fromLs) return fromLs;

  // PWA / standalone: cookie may exist while localStorage was empty (or partitioned).
  // Hydrate so client session matches middleware auth.
  const fromCookie = readAuthCookieToken();
  if (fromCookie) {
    localStorage.setItem(GAS_AUTH_TOKEN_KEY, fromCookie);
    return fromCookie;
  }
  return null;
}

function readAuthCookieToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${GAS_AUTH_TOKEN_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`)
  );
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function setStoredAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(GAS_AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(GAS_AUTH_TOKEN_KEY);
    // Keep middleware + client in sync when session dies.
    document.cookie = `${GAS_AUTH_TOKEN_KEY}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ session: GasSession | null; error: string | null }> {
  try {
    const data = await gasPost<{
      success?: boolean;
      accessToken?: string;
      user?: GasUser;
      error?: string;
      message?: string;
    }>({
      action: "login",
      email: email.trim().toLowerCase(),
      password,
    });

    if (data.error || !data.accessToken || !data.user) {
      return {
        session: null,
        error: data.message || data.error || "Невірний email або пароль",
      };
    }

    setStoredAuthToken(data.accessToken);
    return {
      session: { user: data.user, accessToken: data.accessToken },
      error: null,
    };
  } catch (err) {
    return {
      session: null,
      error: err instanceof Error ? err.message : "Помилка входу",
    };
  }
}

export async function registerAccount(payload: {
  email: string;
  password: string;
  tenantName: string;
}): Promise<{ success: boolean; error: string | null; accessToken?: string }> {
  try {
    const data = await gasPost<{
      success?: boolean;
      error?: string;
      message?: string;
      accessToken?: string;
    }>({
      action: "register",
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      tenantName: payload.tenantName.trim(),
    });

    if (data.error || !data.success) {
      return { success: false, error: data.message || data.error || "Помилка реєстрації" };
    }
    return { success: true, error: null, accessToken: data.accessToken };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Помилка реєстрації",
    };
  }
}

export async function signOut(): Promise<void> {
  const token = getStoredAuthToken();
  try {
    if (token) {
      await gasPost({ action: "logout" }, { authToken: token });
    }
  } catch {
    /* ignore */
  }
  setStoredAuthToken(null);
}

export async function getSession(): Promise<GasSession | null> {
  const token = getStoredAuthToken();
  if (!token) return null;

  try {
    const data = await gasFetch<{
      user?: GasUser;
      accessToken?: string;
      error?: string;
    }>({ action: "getSession" }, { authToken: token });

    if (data.error || !data.user) {
      setStoredAuthToken(null);
      return null;
    }

    return {
      user: data.user,
      accessToken: data.accessToken || token,
    };
  } catch {
    setStoredAuthToken(null);
    return null;
  }
}

/** Session + membership in one GAS call (faster admin boot, less lock contention). */
export async function fetchAdminBoot(
  authToken?: string | null
): Promise<{
  session: GasSession | null;
  membership: TenantMembership | null;
  error: string | null;
}> {
  const token = authToken ?? getStoredAuthToken();
  if (!token) {
    return { session: null, membership: null, error: null };
  }

  try {
    const data = await gasFetch<{
      user?: GasUser;
      accessToken?: string;
      membership?: TenantMembership;
      error?: string;
      message?: string;
    }>({ action: "adminBoot" }, { authToken: token });

    if (data.error || !data.user) {
      setStoredAuthToken(null);
      return {
        session: null,
        membership: null,
        error: data.message || data.error || "Сесія закінчилась",
      };
    }

    const session: GasSession = {
      user: data.user,
      accessToken: data.accessToken || token,
    };

    if (!data.membership?.tenantId) {
      return {
        session,
        membership: null,
        error:
          data.message ||
          "Ваш обліковий запис не привʼязаний до комплексу. Зверніться до підтримки.",
      };
    }

    return { session, membership: data.membership, error: null };
  } catch (err) {
    return {
      session: null,
      membership: null,
      error: err instanceof Error ? err.message : "Помилка завантаження профілю",
    };
  }
}

export async function fetchMembership(
  authToken?: string | null
): Promise<{ membership: TenantMembership | null; error: string | null }> {
  const token = authToken ?? getStoredAuthToken();
  if (!token) {
    return { membership: null, error: "Не авторизовано" };
  }

  try {
    const data = await gasFetch<{
      membership?: TenantMembership;
      error?: string;
      message?: string;
    }>({ action: "getMembership" }, { authToken: token });

    if (data.error || !data.membership?.tenantId) {
      return {
        membership: null,
        error:
          data.message ||
          data.error ||
          "Ваш обліковий запис не привʼязаний до комплексу. Зверніться до підтримки.",
      };
    }

    return { membership: data.membership, error: null };
  } catch (err) {
    return {
      membership: null,
      error: err instanceof Error ? err.message : "Помилка завантаження профілю",
    };
  }
}

export async function verifyAuthToken(
  token: string,
  tenantId: string
): Promise<{ userId: string; email?: string } | null> {
  try {
    const data = await gasFetch<{
      valid?: boolean;
      userId?: string;
      email?: string;
    }>({ action: "verifyToken", tenant_id: tenantId }, { authToken: token });

    if (!data.valid || !data.userId) return null;
    return { userId: data.userId, email: data.email };
  } catch {
    return null;
  }
}

// --- Rooms & bookings ---

export async function fetchRooms(tenantId: string): Promise<unknown[]> {
  const data = await gasFetch<{ rooms?: unknown[]; settings?: { roomsList?: unknown[] } }>(
    { action: "settings", tenant_id: tenantId },
    { authToken: getStoredAuthToken() }
  );
  if (Array.isArray(data.rooms)) return data.rooms;
  const roomsList = data.settings?.roomsList;
  return Array.isArray(roomsList) ? roomsList : [];
}

export async function fetchInitData(
  tenantId: string,
  authToken?: string | null
): Promise<AdminInitResponse> {
  const action = authToken ? "adminInitData" : "initData";
  return gasFetch<AdminInitResponse>(
    { action, tenant_id: tenantId, t: Date.now() },
    { authToken: authToken ?? undefined }
  );
}

export async function fetchPublicTenantData(
  tenantId: string
): Promise<PublicTenantPayload | null> {
  try {
    const data = await gasFetch<PublicTenantPayload & { error?: string }>({
      action: "fetchPublicTenant",
      tenant_id: tenantId,
    });
    if (data.error || !data.tenantId) return null;
    return data;
  } catch (err) {
    console.error("fetchPublicTenantData:", err);
    return null;
  }
}

export async function fetchTenants(): Promise<
  Array<{
    id: string;
    name: string;
    subdomain: string;
    tenant_settings?: Array<{ rooms_list?: unknown[]; branding?: Record<string, unknown> }>;
  }>
> {
  try {
    const data = await gasFetch<{ tenants?: unknown[] }>({ action: "fetchTenants" });
    return (data.tenants ?? []) as Array<{
      id: string;
      name: string;
      subdomain: string;
      tenant_settings?: Array<{ rooms_list?: unknown[]; branding?: Record<string, unknown> }>;
    }>;
  } catch (err) {
    console.error("fetchTenants:", err);
    return [];
  }
}

export async function checkAvailability(params: {
  tenantId: string;
  roomId?: string | number;
  roomName?: string;
  checkIn: string;
  checkOut: string;
}): Promise<{ available: boolean; error?: string; requiredMin?: number; nights?: number }> {
  return gasFetch({
    action: "checkAvailability",
    tenant_id: params.tenantId,
    roomId: params.roomId,
    roomName: params.roomName,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
  });
}

export async function createBooking(
  payload: Record<string, unknown>,
  authToken?: string | null
): Promise<{
  success?: boolean;
  error?: string;
  requiredMin?: number;
  nights?: number;
  orderId?: string;
  prepayment?: number;
  paymentData?: Record<string, unknown>;
}> {
  return gasPost(payload, { authToken: authToken ?? getStoredAuthToken() });
}

export async function confirmBookingPayment(
  orderReference: string,
  amountPaid: number,
  meta?: { provider?: string; transactionId?: string; testMode?: boolean }
): Promise<{
  ok: boolean;
  updated?: boolean;
  bookingId?: string;
  displayId?: string;
  reason?: string;
  message?: string;
}> {
  try {
    return await gasPost({
      action: "confirmBookingPayment",
      orderReference,
      amountPaid,
      paymentProvider: meta?.provider,
      transactionId: meta?.transactionId,
      paymentTestMode: meta?.testMode === true,
      webhookSecret: reviewWebhookSecret(),
    });
  } catch (err) {
    return {
      ok: false,
      reason: "db_error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function recordBookingRefund(params: {
  orderReference: string;
  amount: number;
  method?: string;
  note?: string;
  transactionId?: string;
  cancelBooking?: boolean;
}): Promise<{
  ok: boolean;
  updated?: boolean;
  displayId?: string;
  paidAmount?: number;
  reason?: string;
  message?: string;
}> {
  try {
    return await gasPost({
      action: "recordBookingRefund",
      orderReference: params.orderReference,
      amount: params.amount,
      method: params.method,
      note: params.note,
      transactionId: params.transactionId,
      cancelBooking: params.cancelBooking === true,
      webhookSecret: reviewWebhookSecret(),
    });
  } catch (err) {
    return {
      ok: false,
      reason: "db_error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getBookingStatusByDisplayId(
  displayId: string
): Promise<string | null> {
  try {
    const data = await gasFetch<{ status?: string }>({
      action: "checkStatus",
      orderId: displayId.trim(),
    });
    return data.status ?? null;
  } catch {
    return null;
  }
}

export type GasBookingRecord = {
  id?: string;
  name?: string;
  phone?: string;
  cottage?: string;
  assignmentState?: "assigned" | "holding";
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  pets?: string;
  prepayAmount?: number;
  paidAmount?: number;
  totalPrice?: number;
  prepayMethod?: string;
  status?: string;
  comment?: string;
  source?: string;
  paymentExpiresAt?: string;
  expiredAt?: string;
  monoInvoiceId?: string;
  monoPageUrl?: string;
  paymentLinkSmsSentAt?: string;
  successSmsSentAt?: string;
  expirySmsSentAt?: string;
  paidTelegramSentAt?: string;
  custom_color?: string;
};

function reviewWebhookSecret(): string {
  return (
    process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    ""
  );
}

export async function fetchBookingByDisplayId(orderId: string): Promise<{
  ok: boolean;
  booking?: GasBookingRecord;
  reason?: string;
}> {
  try {
    return await gasPost({
      action: "getBookingByDisplayId",
      orderId: orderId.trim(),
      webhookSecret: reviewWebhookSecret(),
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

function paymentLifecycleSecret(): string {
  return reviewWebhookSecret();
}

export async function storeMonoInvoice(params: {
  orderId: string;
  invoiceId: string;
  pageUrl: string;
  force?: boolean;
}): Promise<{ ok: boolean; stored?: boolean; booking?: GasBookingRecord; reason?: string }> {
  return gasPost({
    action: "storeMonoInvoice",
    ...params,
    webhookSecret: paymentLifecycleSecret(),
  });
}

export async function clearMonoPaymentAttempt(orderId: string): Promise<{
  ok: boolean;
  cleared?: boolean;
  booking?: GasBookingRecord;
  reason?: string;
}> {
  return gasPost({
    action: "clearMonoPaymentAttempt",
    orderId,
    webhookSecret: paymentLifecycleSecret(),
  });
}

export async function listPaymentLifecycle(): Promise<{
  ok: boolean;
  due?: GasBookingRecord[];
  pendingSms?: GasBookingRecord[];
  pendingTelegram?: GasBookingRecord[];
  reason?: string;
}> {
  try {
    return await gasPost({
      action: "listPaymentLifecycle",
      webhookSecret: paymentLifecycleSecret(),
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function expireBookingPayment(orderId: string): Promise<{
  ok: boolean;
  expired?: boolean;
  booking?: GasBookingRecord;
  reason?: string;
}> {
  try {
    return await gasPost({
      action: "expireBookingPayment",
      orderId,
      webhookSecret: paymentLifecycleSecret(),
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function markBookingSmsSent(
  orderId: string,
  smsType: "payment_link" | "success" | "expiry"
): Promise<{ ok: boolean; claimed?: boolean; already?: boolean; reason?: string }> {
  return gasPost({
    action: "markBookingSmsSent",
    orderId,
    smsType,
    webhookSecret: paymentLifecycleSecret(),
  });
}

export async function markPaidBookingTelegramSent(
  orderId: string
): Promise<{ ok: boolean; claimed?: boolean; already?: boolean; reason?: string }> {
  return gasPost({
    action: "markPaidBookingTelegramSent",
    orderId,
    webhookSecret: paymentLifecycleSecret(),
  });
}

export async function reviewBookingDecision(params: {
  orderId: string;
  decision: "approve" | "reject";
  authToken?: string | null;
  tenantId?: string | null;
}): Promise<{
  ok: boolean;
  booking?: GasBookingRecord;
  reason?: string;
  error?: string;
}> {
  try {
    const payload: Record<string, unknown> = {
      action: "reviewBooking",
      orderId: params.orderId.trim(),
      decision: params.decision,
      webhookSecret: reviewWebhookSecret(),
    };
    if (params.tenantId) {
      payload.tenant_id = params.tenantId;
    }
    const data = await gasPost<{
      ok?: boolean;
      booking?: GasBookingRecord;
      reason?: string;
      error?: string;
      success?: boolean;
      message?: string;
    }>(payload, { authToken: params.authToken ?? undefined });

    if (data.ok === true) {
      return { ok: true, booking: data.booking };
    }

    const err = String(data.error || data.reason || data.message || "update_failed");
    return {
      ok: false,
      reason: err.toLowerCase().includes("unauthorized") ? "unauthorized" : err,
      error: data.error,
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function uploadFile(params: {
  tenantId: string;
  path: string;
  base64: string;
  contentType: string;
  upsert?: boolean;
  authToken?: string | null;
}): Promise<{ publicUrl: string }> {
  const data = await gasPost<{ publicUrl?: string; error?: string }>(
    {
      action: "uploadFile",
      tenant_id: params.tenantId,
      path: params.path,
      base64: params.base64,
      contentType: params.contentType,
      upsert: params.upsert ?? false,
    },
    { authToken: params.authToken ?? getStoredAuthToken() }
  );

  if (!data.publicUrl) {
    throw new Error(data.error || "Не вдалося завантажити файл");
  }
  return { publicUrl: data.publicUrl };
}

export async function listTeamMembers(): Promise<{
  members: TeamMemberPublic[];
  maxMembers: number;
}> {
  const data = await gasFetch<{
    members?: TeamMemberPublic[];
    maxMembers?: number;
    error?: string;
    message?: string;
  }>({ action: "listTeamMembers" }, { authToken: getStoredAuthToken() });
  if (data.error) {
    throw new Error(data.message || data.error);
  }
  return {
    members: Array.isArray(data.members) ? data.members : [],
    maxMembers: Number(data.maxMembers) || 5,
  };
}

export type ActivityChangeLine = {
  label?: string;
  from?: string;
  to?: string;
};

export type ActivityLogEntry = {
  id: string;
  at: string;
  type: string;
  summary: string;
  details?: {
    orderId?: string;
    name?: string;
    cottage?: string;
    saveKeys?: string[];
    changes?: ActivityChangeLine[];
    [key: string]: unknown;
  };
  actor?: {
    userId?: string;
    name?: string;
    email?: string;
    role?: string;
  };
};

export async function listActivityLog(): Promise<{
  items: ActivityLogEntry[];
  total: number;
}> {
  const data = await gasFetch<{
    items?: ActivityLogEntry[];
    total?: number;
    error?: string;
    message?: string;
  }>({ action: "listActivityLog" }, { authToken: getStoredAuthToken() });
  if (data.error) {
    throw new Error(data.message || data.error);
  }
  return {
    items: Array.isArray(data.items) ? data.items : [],
    total: Number(data.total) || 0,
  };
}

export async function createTeamMember(input: {
  name: string;
  email: string;
  role: "owner" | "admin";
  mode: "password" | "invite";
  password?: string;
  inviteBaseUrl?: string;
}): Promise<{
  member: TeamMemberPublic;
  inviteUrl?: string | null;
  inviteToken?: string | null;
}> {
  const data = await gasPost<{
    success?: boolean;
    member?: TeamMemberPublic;
    inviteUrl?: string | null;
    inviteToken?: string | null;
    error?: string;
    message?: string;
  }>(
    {
      action: "createTeamMember",
      ...input,
    },
    { authToken: getStoredAuthToken() }
  );
  if (!data.success || !data.member) {
    throw new Error(data.message || data.error || "Не вдалося додати");
  }
  return {
    member: data.member,
    inviteUrl: data.inviteUrl,
    inviteToken: data.inviteToken,
  };
}

export async function updateTeamMember(input: {
  id: string;
  name?: string;
  role?: "owner" | "admin";
  active?: boolean;
  password?: string;
}): Promise<TeamMemberPublic> {
  const data = await gasPost<{
    success?: boolean;
    member?: TeamMemberPublic;
    error?: string;
    message?: string;
  }>(
    {
      action: "updateTeamMember",
      ...input,
    },
    { authToken: getStoredAuthToken() }
  );
  if (!data.success || !data.member) {
    throw new Error(data.message || data.error || "Не вдалося оновити");
  }
  return data.member;
}

export async function fetchInviteInfo(token: string): Promise<{
  email: string;
  name: string;
  role: "owner" | "admin";
  tenantName: string;
}> {
  const data = await gasFetch<{
    email?: string;
    name?: string;
    role?: "owner" | "admin";
    tenantName?: string;
    error?: string;
    message?: string;
  }>({ action: "getInviteInfo", token });
  if (data.error || !data.email) {
    throw new Error(data.message || data.error || "Запрошення недійсне");
  }
  return {
    email: data.email,
    name: data.name || "",
    role: data.role === "admin" ? "admin" : "owner",
    tenantName: data.tenantName || "",
  };
}

export async function acceptTeamInvite(input: {
  inviteToken: string;
  password: string;
  name?: string;
}): Promise<GasSession> {
  const data = await gasPost<{
    success?: boolean;
    accessToken?: string;
    user?: GasUser;
    error?: string;
    message?: string;
  }>({
    action: "acceptTeamInvite",
    ...input,
  });
  if (!data.success || !data.accessToken || !data.user) {
    throw new Error(data.message || data.error || "Не вдалося прийняти запрошення");
  }
  setStoredAuthToken(data.accessToken);
  return { user: data.user, accessToken: data.accessToken };
}

export function getGasApiUrl(): string {
  return GAS_URL();
}
