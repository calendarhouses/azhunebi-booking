import { AdminUnauthorizedError } from "@/lib/admin/adminSession";
import {
  createBooking,
  fetchAdminChessboard,
  fetchAdminDeferred,
  fetchAdminSync,
  fetchInitData,
  gasFetch,
  gasPost,
  getStoredAuthToken,
} from "@/lib/gas-api";
import { API_URL } from "./constants";
import type { AdminInitResponse, AdminSettingsPayload } from "./types";

let tenantIdOverride: string | null = null;

export function setAdminTenantId(id: string) {
  tenantIdOverride = id;
  if (typeof window !== "undefined") {
    (window as Window & { __ADMIN_TENANT_ID__?: string }).__ADMIN_TENANT_ID__ = id;
  }
}

export function clearAdminTenantId() {
  tenantIdOverride = null;
  if (typeof window !== "undefined") {
    delete (window as Window & { __ADMIN_TENANT_ID__?: string }).__ADMIN_TENANT_ID__;
  }
}

export function getAdminTenantId(): string {
  if (tenantIdOverride) return tenantIdOverride;
  if (typeof window !== "undefined") {
    const fromWindow = (window as Window & { __ADMIN_TENANT_ID__?: string }).__ADMIN_TENANT_ID__;
    if (fromWindow) return fromWindow;
  }
  return "";
}

async function getAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  return getStoredAuthToken();
}

export async function adminApiFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init?.headers);
  headers.set("x-tenant-id", getAdminTenantId());
  const isFormData = init?.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type") && init?.method === "POST") {
    headers.set("Content-Type", "text/plain;charset=utf-8");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_GAS_URL is not configured");
  }

  let targetUrl = API_URL;
  let body = init?.body;

  if (init?.method === "POST") {
    if (typeof body === "string") {
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        parsed.tenant_id = parsed.tenant_id ?? getAdminTenantId();
        body = JSON.stringify(parsed);
      } catch {
        /* not JSON */
      }
    }
  } else {
    const queryStart = url.indexOf("?");
    const query = queryStart >= 0 ? url.slice(queryStart + 1) : "";
    const params = new URLSearchParams(query);
    if (!params.has("tenant_id")) {
      params.set("tenant_id", getAdminTenantId());
    }
    targetUrl = `${API_URL}${API_URL.includes("?") ? "&" : "?"}${params.toString()}`;
  }

  const res = await fetch(targetUrl, {
    ...init,
    headers,
    body,
    redirect: "follow",
  });

  if (res.status === 401) {
    throw new AdminUnauthorizedError();
  }

  return res;
}

export async function fetchAdminInitData(tenantIdOverride?: string): Promise<AdminInitResponse> {
  const tenantId = (tenantIdOverride || getAdminTenantId()).trim();
  if (!tenantId) {
    // Not a session error — caller should retry after tenant is set.
    throw new Error("MISSING_TENANT");
  }
  if (!getAdminTenantId()) {
    setAdminTenantId(tenantId);
  }
  const token = await getAccessToken();
  return fetchInitData(tenantId, token);
}

/** Stage-A first paint — slim rooms + chessboard bookings. */
export async function fetchAdminChessboardData(
  tenantIdOverride?: string
): Promise<AdminInitResponse> {
  const tenantId = (tenantIdOverride || getAdminTenantId()).trim();
  if (!tenantId) {
    throw new Error("MISSING_TENANT");
  }
  if (!getAdminTenantId()) {
    setAdminTenantId(tenantId);
  }
  const token = await getAccessToken();
  return fetchAdminChessboard(tenantId, token);
}

function isTransientChessboardError(err: unknown): boolean {
  if (err instanceof AdminUnauthorizedError) return false;
  const msg = err instanceof Error ? err.message : String(err || "");
  const lower = msg.toLowerCase();
  if (lower.includes("missing_tenant") || lower.includes("unauthorized")) return false;
  return (
    lower.includes("502") ||
    lower.includes("504") ||
    lower.includes("gas_bad_response") ||
    lower.includes("gas_timeout") ||
    lower.includes("gas_unreachable") ||
    lower.includes("gas_rate_limited") ||
    lower.includes("не json") ||
    lower.includes("timeout") ||
    lower.includes("aborted") ||
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("invalid chessboard") ||
    lower.includes("не вдалося завантажити шахматку")
  );
}

function isValidChessboard(data: AdminInitResponse | null | undefined): boolean {
  if (!data || typeof data !== "object") return false;
  if ((data as { error?: string }).error) return false;
  if (!data.settings || typeof data.settings !== "object") return false;
  return Array.isArray(data.bookings);
}

/**
 * Chessboard boot with retries. Prefetch failures must not stick — we clear
 * and fetch fresh so a 502 while Google is busy does not permanently block paint.
 */
export async function fetchAdminChessboardWithRetry(
  tenantIdOverride?: string,
  options?: { attempts?: number }
): Promise<AdminInitResponse> {
  const tenantId = (tenantIdOverride || getAdminTenantId()).trim();
  if (!tenantId) throw new Error("MISSING_TENANT");

  const { consumePrefetchedAdminInit, clearAdminInitPrefetch } = await import(
    "@/lib/admin/adminInitPrefetch"
  );

  const prefetched = consumePrefetchedAdminInit(tenantId);
  if (prefetched) {
    try {
      const data = await prefetched;
      if (isValidChessboard(data)) return data;
      clearAdminInitPrefetch();
    } catch {
      clearAdminInitPrefetch();
    }
  }

  const attempts = options?.attempts ?? 3;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const data = await fetchAdminChessboardData(tenantId);
      if (!isValidChessboard(data)) {
        throw new Error("Не вдалося завантажити шахматку");
      }
      return data;
    } catch (err) {
      lastErr = err;
      if (!isTransientChessboardError(err) || i === attempts - 1) throw err;
      const waitMs = 1200 * (i + 1);
      console.warn(
        `[adminChessboard] transient failure, retry ${i + 1}/${attempts} in ${waitMs}ms`,
        err
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Не вдалося завантажити шахматку");
}

/** Stage-A after paint — full settings + list bookings. */
export async function fetchAdminDeferredData(
  tenantIdOverride?: string
): Promise<AdminInitResponse | null> {
  try {
    const tenantId = (tenantIdOverride || getAdminTenantId()).trim();
    if (!tenantId) return null;
    const token = await getAccessToken();
    return await fetchAdminDeferred(tenantId, token);
  } catch (e) {
    if (e instanceof AdminUnauthorizedError) {
      throw e;
    }
    console.error("Помилка довантаження налаштувань:", e);
    return null;
  }
}

/** Stage-A silent sync — chessboard-sized, not full adminInitData. */
export async function silentSyncAdminData(): Promise<AdminInitResponse | null> {
  try {
    const tenantId = getAdminTenantId().trim();
    if (!tenantId) return null;
    const token = await getAccessToken();
    return await fetchAdminSync(tenantId, token);
  } catch (e) {
    if (e instanceof AdminUnauthorizedError) {
      throw e;
    }
    console.error("Помилка фонового оновлення:", e);
    return null;
  }
}

/** Full booking row (payments + changeHistory) — lazy, after drawer open. */
export async function fetchAdminBookingDetail(bookingId: string): Promise<{
  booking: import("./types").BookingRecord;
} | null> {
  const token = await getAccessToken();
  if (!token || !bookingId) return null;
  const data = await gasPost<{
    booking?: import("./types").BookingRecord;
    error?: string;
  }>(
    {
      action: "getBookingDetail",
      tenant_id: getAdminTenantId(),
      id: bookingId,
    },
    { authToken: token }
  );
  if (data.error || !data.booking) return null;
  return { booking: data.booking };
}

export async function fetchAdminBookingChangeHistory(
  bookingId: string
): Promise<import("./types").BookingChangeHistoryEntry[]> {
  const token = await getAccessToken();
  if (!token || !bookingId) return [];
  const data = await gasPost<{
    changeHistory?: import("./types").BookingChangeHistoryEntry[];
    error?: string;
  }>(
    {
      action: "getBookingChangeHistory",
      tenant_id: getAdminTenantId(),
      id: bookingId,
    },
    { authToken: token }
  );
  if (data.error || !Array.isArray(data.changeHistory)) return [];
  return data.changeHistory;
}

/** Transactions omitted from boot — load when opening Reports. */
export async function fetchAdminTransactions(): Promise<
  NonNullable<AdminSettingsPayload["transactions"]>
> {
  const token = await getAccessToken();
  const settings = await gasFetch<AdminSettingsPayload>(
    { action: "settings", tenant_id: getAdminTenantId() },
    { authToken: token }
  );
  return Array.isArray(settings.transactions) ? settings.transactions : [];
}

export async function submitBookingReview(params: {
  orderId: string;
  decision: "approve" | "reject";
}): Promise<{ ok: boolean; reason?: string; smsLine?: string }> {
  const token = await getAccessToken();
  const headers = new Headers({
    "Content-Type": "application/json",
    "x-tenant-id": getAdminTenantId(),
  });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch("/api/booking-review", {
    method: "POST",
    headers,
    body: JSON.stringify(params),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    reason?: string;
    smsLine?: string;
  };
  if (!res.ok) {
    return { ok: false, reason: data.reason || `http_${res.status}` };
  }
  return { ok: Boolean(data.ok), reason: data.reason, smsLine: data.smsLine };
}

export async function submitBookingRefund(params: {
  orderId: string;
  amountUah: number;
  cancelBooking?: boolean;
}): Promise<{
  ok: boolean;
  error?: string;
  message?: string;
  paidAmount?: number;
  recorded?: boolean;
  warning?: string;
}> {
  const token = await getAccessToken();
  const headers = new Headers({
    "Content-Type": "application/json",
    "x-tenant-id": getAdminTenantId(),
  });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch("/api/payments/refund", {
    method: "POST",
    headers,
    body: JSON.stringify(params),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    message?: string;
    paidAmount?: number;
    recorded?: boolean;
    warning?: string;
  };
  if (!res.ok) {
    return { ok: false, error: data.error || `http_${res.status}`, message: data.message };
  }
  return {
    ok: Boolean(data.ok),
    error: data.error,
    message: data.message,
    paidAmount: data.paidAmount,
    recorded: data.recorded,
    warning: data.warning,
  };
}

export async function postAdminBooking(
  payload: Record<string, unknown>
): Promise<{ success?: boolean; error?: string; requiredMin?: number; orderId?: string }> {
  const token = await getAccessToken();
  const data = await createBooking(
    {
      ...payload,
      action: "createBooking",
      tenant_id: payload.tenant_id ?? getAdminTenantId(),
      adminOverrideRestrictions: true,
    },
    token
  );
  if (data.error === "UNAUTHORIZED") {
    throw new AdminUnauthorizedError();
  }
  return data;
}

export async function deleteAdminBooking(
  booking: number | string | { row?: number | string; id?: string }
): Promise<void> {
  const token = await getAccessToken();
  const payload =
    typeof booking === "object" && booking !== null
      ? { action: "deleteBooking", row: booking.row, id: booking.id }
      : { action: "deleteBooking", row: booking };

  const data = await gasPost(
    {
      ...payload,
      tenant_id: getAdminTenantId(),
    },
    { authToken: token }
  );

  if ((data as { error?: string }).error === "UNAUTHORIZED") {
    throw new AdminUnauthorizedError();
  }
  if ((data as { error?: string }).error) {
    throw new Error((data as { error?: string }).error);
  }
}

export type SaveAdminSettingsOptions = {
  /** Які секції записати (менший payload + швидший GAS). Без keys — усі передані поля. */
  keys?: Array<keyof AdminSettingsPayload>;
};

function pickSettingsSlice(
  settings: AdminSettingsPayload,
  keys?: Array<keyof AdminSettingsPayload>
): Partial<AdminSettingsPayload> {
  if (!keys?.length) return settings;
  const slice: Partial<AdminSettingsPayload> = {};
  for (const key of keys) {
    (slice as Record<string, unknown>)[key] = settings[key];
  }
  return slice;
}

export async function saveAdminSettings(
  settings: AdminSettingsPayload,
  options?: SaveAdminSettingsOptions
): Promise<void> {
  const token = await getAccessToken();
  const keys = options?.keys;
  const data = await gasPost(
    {
      action: "saveSettings",
      tenant_id: getAdminTenantId(),
      settings: pickSettingsSlice(settings, keys),
      saveKeys: keys?.length ? keys : undefined,
    },
    { authToken: token }
  );

  if ((data as { error?: string }).error === "UNAUTHORIZED") {
    throw new AdminUnauthorizedError();
  }
  if ((data as { error?: string }).error) {
    throw new Error((data as { error?: string }).error);
  }
}

export async function fetchAdminSettings(): Promise<AdminSettingsPayload> {
  const token = await getAccessToken();
  return gasFetch<AdminSettingsPayload>(
    { action: "settings", tenant_id: getAdminTenantId() },
    { authToken: token }
  );
}
