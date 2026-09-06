import "server-only";

import type { AdminInitResponse } from "@/components/admin/desktop/types";
import type { PublicTenantPayload } from "@/lib/public-booking/types";
import { handleBackendRequest } from "@/lib/backend/handleBackendRequest";

export type GasBookingRecord = {
  id?: string;
  name?: string;
  phone?: string;
  cottage?: string;
  roomId?: string | number;
  assignmentState?: "assigned" | "holding";
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  pets?: string;
  prepayAmount?: number;
  paidAmount?: number;
  surchargeAmount?: number;
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

const GAS_FETCH_TIMEOUT_MS = 45_000;

function gasFetchSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(GAS_FETCH_TIMEOUT_MS);
  }
  return undefined;
}

function assertGasUrl(): string {
  const url = process.env.NEXT_PUBLIC_GAS_URL?.trim() || "";
  if (!url) {
    throw new Error("NEXT_PUBLIC_GAS_URL is not configured");
  }
  return url;
}

function throwBackendError(status: number, body: Record<string, unknown>): void {
  const errCode = String(body.error || "");
  if (status === 401 || errCode === "UNAUTHORIZED") {
    throw new Error("UNAUTHORIZED");
  }
  throw new Error(String(body.message || body.error || `HTTP ${status}`));
}

function webhookSecret(): string {
  return (
    process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    ""
  );
}

/** Server-only: route through DATA_SOURCE dispatcher (Supabase or GAS), no HTTP loopback. */
export async function serverGasFetch<T>(
  params: Record<string, string | number | undefined>,
  authToken?: string | null
): Promise<T> {
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v) !== "") query[k] = String(v);
  }
  const result = await handleBackendRequest(
    { method: "GET", token: authToken || null, query, body: null },
    async (req) => {
      const url = assertGasUrl();
      const target = new URL(url);
      for (const [k, v] of Object.entries(req.query)) target.searchParams.set(k, v);
      if (req.token) target.searchParams.set("token", req.token);
      const res = await fetch(target.toString(), {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
        signal: gasFetchSignal(),
      });
      const data = (await res.json()) as Record<string, unknown>;
      return { status: res.status, body: data };
    }
  );
  if (result.status >= 400) {
    throwBackendError(result.status, result.body);
  }
  return result.body as T;
}

export async function serverGasPost<T>(
  body: Record<string, unknown>,
  authToken?: string | null
): Promise<T> {
  const payload = { ...body };
  if (authToken && payload.accessToken === undefined) payload.accessToken = authToken;
  const result = await handleBackendRequest(
    { method: "POST", token: authToken || null, query: {}, body: payload },
    async (req) => {
      const url = assertGasUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(req.body || {}),
        cache: "no-store",
        redirect: "follow",
        signal: gasFetchSignal(),
      });
      const data = (await res.json()) as Record<string, unknown>;
      return { status: res.status, body: data };
    }
  );
  if (result.status >= 400) {
    throwBackendError(result.status, result.body);
  }
  return result.body as T;
}

export async function fetchInitData(
  tenantId: string,
  authToken?: string | null
): Promise<AdminInitResponse> {
  const action = authToken ? "adminInitData" : "initData";
  return serverGasFetch<AdminInitResponse>(
    { action, tenant_id: tenantId, t: Date.now() },
    authToken
  );
}

export async function fetchPublicTenantData(
  tenantId: string
): Promise<PublicTenantPayload | null> {
  try {
    const data = await serverGasFetch<PublicTenantPayload & { error?: string }>({
      action: "fetchPublicTenant",
      tenant_id: tenantId,
    });
    if (data.error || !data.tenantId) return null;
    return data;
  } catch (err) {
    console.error("[gas-api-server] fetchPublicTenantData:", err);
    return null;
  }
}

export async function registerAccount(payload: {
  email: string;
  password: string;
  tenantName: string;
}): Promise<{ success: boolean; error: string | null; accessToken?: string }> {
  try {
    const data = await serverGasPost<{
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
  return serverGasPost(payload, authToken);
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
    return await serverGasPost({
      action: "confirmBookingPayment",
      orderReference,
      amountPaid,
      paymentProvider: meta?.provider,
      transactionId: meta?.transactionId,
      paymentTestMode: meta?.testMode === true,
      webhookSecret: webhookSecret(),
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
  actorName?: string;
  actorRole?: string;
}): Promise<{
  ok: boolean;
  updated?: boolean;
  displayId?: string;
  paidAmount?: number;
  reason?: string;
  message?: string;
}> {
  try {
    return await serverGasPost({
      action: "recordBookingRefund",
      orderReference: params.orderReference,
      amount: params.amount,
      method: params.method,
      note: params.note,
      transactionId: params.transactionId,
      cancelBooking: params.cancelBooking === true,
      actorName: params.actorName,
      actorRole: params.actorRole,
      webhookSecret: webhookSecret(),
    });
  } catch (err) {
    return {
      ok: false,
      reason: "db_error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getBookingStatusByDisplayId(displayId: string): Promise<string | null> {
  try {
    const data = await serverGasFetch<{ status?: string }>({
      action: "checkStatus",
      orderId: displayId.trim(),
    });
    return data.status ?? null;
  } catch {
    return null;
  }
}

export async function fetchBookingByDisplayId(orderId: string): Promise<{
  ok: boolean;
  booking?: GasBookingRecord;
  reason?: string;
}> {
  try {
    return await serverGasPost({
      action: "getBookingByDisplayId",
      orderId: orderId.trim(),
      webhookSecret: webhookSecret(),
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function storeMonoInvoice(params: {
  orderId: string;
  invoiceId: string;
  pageUrl: string;
  force?: boolean;
}): Promise<{ ok: boolean; stored?: boolean; booking?: GasBookingRecord; reason?: string }> {
  return serverGasPost({
    action: "storeMonoInvoice",
    ...params,
    webhookSecret: webhookSecret(),
  });
}

export async function clearMonoPaymentAttempt(orderId: string): Promise<{
  ok: boolean;
  cleared?: boolean;
  booking?: GasBookingRecord;
  reason?: string;
}> {
  return serverGasPost({
    action: "clearMonoPaymentAttempt",
    orderId,
    webhookSecret: webhookSecret(),
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
    return await serverGasPost({
      action: "listPaymentLifecycle",
      webhookSecret: webhookSecret(),
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
    return await serverGasPost({
      action: "expireBookingPayment",
      orderId,
      webhookSecret: webhookSecret(),
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
  return serverGasPost({
    action: "markBookingSmsSent",
    orderId,
    smsType,
    webhookSecret: webhookSecret(),
  });
}

export async function clearBookingSmsSent(
  orderId: string,
  smsType: "payment_link" | "success" | "expiry"
): Promise<{ ok: boolean; reason?: string }> {
  try {
    return await serverGasPost({
      action: "clearBookingSmsSent",
      orderId,
      smsType,
      webhookSecret: webhookSecret(),
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function markPaidBookingTelegramSent(
  orderId: string
): Promise<{ ok: boolean; claimed?: boolean; already?: boolean; reason?: string }> {
  return serverGasPost({
    action: "markPaidBookingTelegramSent",
    orderId,
    webhookSecret: webhookSecret(),
  });
}

export async function reviewBookingDecision(params: {
  orderId: string;
  decision: "approve" | "reject";
  authToken?: string | null;
  tenantId?: string | null;
}): Promise<{
  ok: boolean;
  already?: boolean;
  booking?: GasBookingRecord;
  reason?: string;
  error?: string;
}> {
  try {
    const payload: Record<string, unknown> = {
      action: "reviewBooking",
      orderId: params.orderId.trim(),
      decision: params.decision,
      webhookSecret: webhookSecret(),
    };
    if (params.tenantId) {
      payload.tenant_id = params.tenantId;
    }
    const data = await serverGasPost<{
      ok?: boolean;
      already?: boolean;
      booking?: GasBookingRecord;
      reason?: string;
      error?: string;
      success?: boolean;
      message?: string;
    }>(payload, params.authToken ?? undefined);

    if (data.ok === true) {
      return { ok: true, already: Boolean(data.already), booking: data.booking };
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

export async function syncBookingsAfterRoomRename(
  tenantId: string,
  oldRooms: unknown[],
  newRooms: unknown[],
  authToken?: string | null
): Promise<void> {
  await serverGasPost(
    {
      action: "syncBookingsAfterRoomRename",
      tenant_id: tenantId,
      oldRooms,
      newRooms,
    },
    authToken
  );
}

export type CronTelegramDigest = {
  bookings: Array<Record<string, unknown>>;
  settings: Record<string, unknown>;
};

export async function fetchCronTelegramDigest(): Promise<CronTelegramDigest> {
  const secret = webhookSecret();
  if (!secret) throw new Error("TELEGRAM_REVIEW_WEBHOOK_SECRET is not set");

  const json = await serverGasPost<CronTelegramDigest & { error?: string }>({
    action: "cronTelegramDigest",
    webhookSecret: secret,
  });

  if (json.error) {
    throw new Error(json.error);
  }
  return {
    bookings: Array.isArray(json.bookings) ? json.bookings : [],
    settings: json.settings && typeof json.settings === "object" ? json.settings : {},
  };
}
