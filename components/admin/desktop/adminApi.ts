import { AdminUnauthorizedError } from "@/lib/admin/adminSession";
import {
  createBooking,
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

export async function fetchAdminInitData(): Promise<AdminInitResponse> {
  const tenantId = getAdminTenantId();
  if (!tenantId) {
    throw new AdminUnauthorizedError("MISSING_TENANT");
  }
  const token = await getAccessToken();
  return fetchInitData(tenantId, token);
}

export async function silentSyncAdminData(): Promise<AdminInitResponse | null> {
  try {
    return await fetchAdminInitData();
  } catch (e) {
    if (e instanceof AdminUnauthorizedError) {
      throw e;
    }
    console.error("Помилка фонового оновлення:", e);
    return null;
  }
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

export async function postAdminBooking(
  payload: Record<string, unknown>
): Promise<{ success?: boolean; error?: string; requiredMin?: number; orderId?: string }> {
  const token = await getAccessToken();
  const data = await createBooking(
    { ...payload, tenant_id: payload.tenant_id ?? getAdminTenantId() },
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
