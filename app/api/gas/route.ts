import { after, NextResponse } from "next/server";
import { BOOKING_STATUS_PENDING_REVIEW, isPendingReviewStatus } from "@/lib/public-booking/bookingReview";
import {
  bumpGasCacheGeneration,
  coalesceKey,
  actionCacheUsesToken,
  gasActionCacheTtlMs,
  isCoalescableGasAction,
  readGasShortCache,
  withGasInflightCoalesce,
  writeGasShortCache,
} from "@/lib/gas/inflightCoalesce";

export const runtime = "nodejs";
// GAS writes with LockService can take 10-20s; without this the gateway kills
// the request at the platform default and returns an HTML page instead of JSON.
export const maxDuration = 60;

const GAS_UPSTREAM_TIMEOUT_MS = 45_000;

function getGasUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_GAS_URL?.trim();
  return url || null;
}

function upstreamSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(GAS_UPSTREAM_TIMEOUT_MS);
  }
  return undefined;
}

function tokenFingerprint(token: string | null | undefined): string {
  return token ? String(token).slice(0, 16) : "";
}

function jsonTextResponse(text: string, status: number, extraHeaders?: Record<string, string>) {
  return new NextResponse(text, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function shouldInvalidateCache(action: string | null | undefined, payload: Record<string, unknown> | null): boolean {
  const a = String(action || "");
  if (
    a === "createBooking" ||
    a === "deleteBooking" ||
    a === "saveSettings" ||
    a === "confirmBookingPayment" ||
    a === "recordBookingRefund" ||
    a === "expireBookingPayment" ||
    a === "storeMonoInvoice" ||
    a === "reviewBooking" ||
    a === "syncBookingsAfterRoomRename" ||
    a === "syncIcalRoomBlocks" ||
    a === "saveGuestProfile"
  ) {
    return true;
  }
  // Bare booking save body (legacy): has checkIn+name without a pure-read action
  if (payload && payload.checkIn && payload.name && (!a || a === "createBooking")) {
    return true;
  }
  return false;
}

function gasUnreachable(method: string, err: unknown): NextResponse {
  const detail = err instanceof Error ? err.message : String(err);
  const timedOut = /abort|timeout/i.test(detail);
  console.error(`[GAS proxy] ${method} upstream failed:`, detail);
  return NextResponse.json(
    {
      error: timedOut ? "GAS_TIMEOUT" : "GAS_UNREACHABLE",
      message: timedOut
        ? "Google Script не відповів вчасно"
        : `Немає звʼязку з Google Script: ${detail}`,
    },
    { status: 504 }
  );
}

/** Pull the human-readable text out of a Google Apps Script HTML error page. */
function extractGasErrorText(html: string): string {
  // Prefer the visible errorMessage div; ignore CSS that also contains ".errorMessage".
  const div = html.match(
    /<div[^>]*class=["']errorMessage["'][^>]*>([\s\S]*?)<\/div>/i
  );
  const raw = div ? div[1] : html;
  const cleaned = raw
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  // Common Sheets limit message often sits after the CSS dump.
  const cellLimit = cleaned.match(
    /Максимал\w+\s+количество\s+символов[^.]{0,80}|Maximum of \d+ characters in a single cell[^.]{0,40}/i
  );
  if (cellLimit) return cellLimit[0].trim();
  return cleaned.slice(0, 600);
}

/** Google returns an HTML page (quota, 429, transient 5xx) instead of our JSON. */
function gasBadResponse(method: string, status: number, body: string): NextResponse {
  const errorText = extractGasErrorText(body);
  console.error(
    `[GAS proxy] non-JSON upstream (${method} HTTP ${status}): ${errorText || body.slice(0, 500).replace(/\s+/g, " ")}`
  );
  const lower = `${errorText} ${body}`.toLowerCase();
  const looksLikeQuota =
    /too many|quota|invoked too many times|exceeded maximum|too much computer time|rate/i.test(
      lower
    );
  const looksLikeCellLimit =
    /50000|символов в одной|characters in a single cell/i.test(lower);
  const looksLikeAuth =
    /authoriz|permission|not have access|unauthor|потрібен доступ|немає доступу/i.test(
      lower
    );
  return NextResponse.json(
    {
      error: looksLikeAuth
        ? "GAS_AUTH_REQUIRED"
        : looksLikeCellLimit
          ? "GAS_CELL_LIMIT"
          : looksLikeQuota
            ? "GAS_RATE_LIMITED"
            : "GAS_BAD_RESPONSE",
      message: looksLikeCellLimit
        ? "Журнал змін у таблиці переповнений (ліміт комірки 50000). Очистіть activityLog у аркуші Settings."
        : errorText
          ? `Google Script: ${errorText}`
          : `Google Script відповів не JSON (HTTP ${status})`,
      upstreamStatus: status,
    },
    { status: 502 }
  );
}

function forwardHeaders(request: Request, method: "GET" | "POST"): Headers {
  const headers = new Headers();
  if (method === "POST") {
    headers.set("Content-Type", "text/plain;charset=utf-8");
  }

  const auth = request.headers.get("authorization");
  if (auth) headers.set("Authorization", auth);

  const gasToken = request.headers.get("x-gas-token");
  if (gasToken && !auth) headers.set("Authorization", `Bearer ${gasToken}`);

  const tenant = request.headers.get("x-tenant-id");
  if (tenant) headers.set("x-tenant-id", tenant);

  return headers;
}

/**
 * Apps Script occasionally receives an empty postData under concurrent load and
 * falls back to its default `{status:"ok",action:null}` response — a valid JSON
 * body that silently looks like success while actually meaning "your POST never
 * arrived". Detect that specific shape and retry once with the same body.
 */
function looksLikeEmptyPostFallback(parsed: unknown, requestedAction: string): boolean {
  if (!requestedAction) return false;
  if (!parsed || typeof parsed !== "object") return false;
  const r = parsed as Record<string, unknown>;
  return r.status === "ok" && r.action === null;
}

async function postToGas(
  gasUrl: string,
  request: Request,
  body: string,
  requestedAction: string
): Promise<{ status: number; text: string; parsed: Record<string, unknown> | null }> {
  let lastStatus = 0;
  let lastText = "";
  let lastParsed: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const upstream = await fetch(gasUrl, {
      method: "POST",
      headers: forwardHeaders(request, "POST"),
      body,
      redirect: "follow",
      cache: "no-store",
      signal: upstreamSignal(),
    });
    const text = await upstream.text();
    lastStatus = upstream.status;
    lastText = text;
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
    lastParsed = parsed;
    if (parsed && !looksLikeEmptyPostFallback(parsed, requestedAction)) {
      return { status: upstream.status, text, parsed };
    }
    if (attempt === 0) {
      console.warn(
        `[GAS proxy] POST ${requestedAction} got empty-postData fallback, retrying`
      );
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  return { status: lastStatus, text: lastText, parsed: lastParsed };
}

function extractBearer(request: Request): string | null {
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  const gasToken = request.headers.get("x-gas-token")?.trim();
  return gasToken || null;
}

async function requireAdminBearer(request: Request): Promise<NextResponse | null> {
  const token = extractBearer(request);
  if (!token) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  // Cheap presence check — full auth is still enforced by GAS for proxied actions.
  // Local TG actions must not be callable anonymously.
  if (token.length < 8) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  return null;
}

async function handleLocalTelegramActions(
  request: Request,
  payload: Record<string, unknown> | null
): Promise<NextResponse | null> {
  if (!payload?.action) return null;

  if (payload.action === "sendFinanceReport" || payload.action === "sendSuccessScreenshot") {
    const authBlock = await requireAdminBearer(request);
    if (authBlock) return authBlock;
  }

  if (payload.action === "sendFinanceReport") {
    const { sendFinanceReportTelegram } = await import("@/lib/telegram/financeNotify");
    const reportResult = await sendFinanceReportTelegram({
      screenshot: String(payload.screenshot || ""),
      periodLabel: String(payload.periodLabel || ""),
    });
    return NextResponse.json(reportResult);
  }

  if (payload.action === "sendSuccessScreenshot") {
    const { notifyNewBookingCreated } = await import("@/lib/telegram/newBookingNotify");
    await notifyNewBookingCreated({
      name: String(payload.name || ""),
      phone: String(payload.phone || ""),
      cottage: String(payload.cottage || ""),
      checkIn: String(payload.checkIn || ""),
      checkOut: String(payload.checkOut || ""),
      guests: Number(payload.guests) || 0,
      pets: payload.pets as string | boolean | undefined,
      source: String(payload.source || "Адмінка"),
      comment: String(payload.comment || ""),
      totalPrice: Number(payload.totalPrice) || 0,
      paidAmount: Number(payload.paidAmount) || 0,
      status: String(payload.status || ""),
    });
    return NextResponse.json({ success: true });
  }

  return null;
}

async function afterBookingTelegramHooks(
  payload: Record<string, unknown>,
  result: Record<string, unknown>
) {
  const isCreate = !payload.row && !payload.id;
  const source = String(payload.source || "");
  const status = String(payload.status || "");
  const isPending =
    status === BOOKING_STATUS_PENDING_REVIEW || isPendingReviewStatus(status);

  if (payload.remainderPaymentAdded) {
    const { notifyPaymentReceived } = await import(
      "@/lib/telegram/paymentReceivedNotify"
    );
    await notifyPaymentReceived({
      name: String(payload.name || ""),
      phone: String(payload.phone || ""),
      cottage: String(payload.cottage || ""),
      checkIn: String(payload.checkIn || ""),
      checkOut: String(payload.checkOut || ""),
      totalPrice: Number(payload.totalPrice) || 0,
      paidAmount: Number(payload.paidAmount) || 0,
      amount: Number(payload.remainderPaymentAmount) || 0,
      method: String(payload.surchargeMethod || payload.prepayMethod || "Готівка"),
      screenshotPayment: payload.screenshotPayment
        ? String(payload.screenshotPayment)
        : undefined,
    });
    return;
  }

  // Site pending handled separately before this; site instant waits for MonoPay paid notify.
  if (source === "Сайт") return;

  if (isCreate && !isPending) {
    const { notifyNewBookingCreated } = await import("@/lib/telegram/newBookingNotify");
    await notifyNewBookingCreated({
      name: String(payload.name || ""),
      phone: String(payload.phone || ""),
      cottage: String(payload.cottage || ""),
      checkIn: String(payload.checkIn || ""),
      checkOut: String(payload.checkOut || ""),
      guests: Number(payload.guests) || 0,
      pets: payload.pets as string | boolean | undefined,
      source: source || "Адмінка",
      comment: String(payload.comment || ""),
      totalPrice: Number(payload.totalPrice) || 0,
      paidAmount: Number(payload.paidAmount) || 0,
      status: status,
      screenshot: payload.screenshot ? String(payload.screenshot) : undefined,
      screenshotCleaning: payload.screenshotCleaning
        ? String(payload.screenshotCleaning)
        : undefined,
    });
  }

  void result;
}

export async function GET(request: Request) {
  const gasUrl = getGasUrl();
  if (!gasUrl) {
    return NextResponse.json(
      { error: "SERVER_MISCONFIGURED", message: "NEXT_PUBLIC_GAS_URL is not set" },
      { status: 500 }
    );
  }

  const incoming = new URL(request.url);
  const target = new URL(gasUrl);
  incoming.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  const token = incoming.searchParams.get("token");
  const headerToken = request.headers.get("x-gas-token");
  const authHeader = request.headers.get("authorization");
  const bearer =
    headerToken ||
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null);
  if (bearer) {
    target.searchParams.set("token", bearer);
  } else if (token) {
    target.searchParams.set("token", token);
  }

  const action = target.searchParams.get("action") || "";
  const tenant =
    target.searchParams.get("tenant_id") ||
    request.headers.get("x-tenant-id") ||
    "";
  const key = coalesceKey({
    method: "GET",
    action,
    tenant,
    tokenFingerprint: actionCacheUsesToken(action)
      ? tokenFingerprint(bearer || token)
      : null,
  });

  if (gasActionCacheTtlMs(action) > 0) {
    const cached = readGasShortCache(key);
    if (cached) {
      return jsonTextResponse(cached.body, cached.status, {
        "x-gas-cache": "HIT",
      });
    }
  }

  const runFetch = async (): Promise<{ status: number; text: string }> => {
    let lastStatus = 0;
    let lastText = "";
    // Under GAS queue pressure, blind retries double the flood. Only retry
    // fast empty/non-JSON flakes (<4s), not slow overloaded responses.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const attemptStarted = Date.now();
      const upstream = await fetch(target.toString(), {
        method: "GET",
        headers: forwardHeaders(request, "GET"),
        redirect: "follow",
        cache: "no-store",
        signal: upstreamSignal(),
      });
      const text = await upstream.text();
      lastStatus = upstream.status;
      lastText = text;
      const elapsed = Date.now() - attemptStarted;
      if (text.trim()) {
        try {
          JSON.parse(text);
          return { status: upstream.status, text };
        } catch {
          // fall through
        }
      }
      if (attempt === 0 && elapsed < 4_000) {
        await new Promise((r) => setTimeout(r, 700));
        continue;
      }
      break;
    }
    return { status: lastStatus, text: lastText };
  };

  try {
    const t0 = Date.now();
    if (isCoalescableGasAction(action)) {
      const { text, shared } = await withGasInflightCoalesce(key, async () => {
        const res = await runFetch();
        if (!res.text.trim()) throw new Error("empty GAS body");
        try {
          JSON.parse(res.text);
        } catch {
          throw new Error("non-JSON GAS body");
        }
        const ttl = gasActionCacheTtlMs(action);
        if (ttl > 0) {
          writeGasShortCache(key, res.text, res.status, ttl);
        }
        return res.text;
      });
      const status = 200;
      console.info(
        `[GAS proxy] GET ${action} ${Date.now() - t0}ms shared=${shared} bytes=${text.length}`
      );
      return jsonTextResponse(text, status, {
        "x-gas-cache": shared ? "COALESCE" : "MISS",
      });
    }

    const res = await runFetch();
    try {
      JSON.parse(res.text);
      console.info(
        `[GAS proxy] GET ${action} ${Date.now() - t0}ms bytes=${res.text.length}`
      );
      return jsonTextResponse(res.text, res.status);
    } catch {
      return gasBadResponse("GET", res.status, res.text);
    }
  } catch (err) {
    if (err instanceof Error && /empty GAS|non-JSON/.test(err.message)) {
      return gasBadResponse("GET", 502, "");
    }
    return gasUnreachable("GET", err);
  }
}

export async function POST(request: Request) {
  const gasUrl = getGasUrl();
  if (!gasUrl) {
    return NextResponse.json(
      { error: "SERVER_MISCONFIGURED", message: "NEXT_PUBLIC_GAS_URL is not set" },
      { status: 500 }
    );
  }

  const body = await request.text();
  let payload: Record<string, unknown> | null = null;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    payload = null;
  }

  try {
    const local = await handleLocalTelegramActions(request, payload);
    if (local) return local;

    const action = payload?.action != null ? String(payload.action) : "";
    const tenant =
      String(payload?.tenant_id || payload?.tenantId || "") ||
      request.headers.get("x-tenant-id") ||
      "";
    const authHeader = request.headers.get("authorization");
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : request.headers.get("x-gas-token");
    const key = coalesceKey({
      method: "POST",
      action,
      tenant,
      tokenFingerprint: actionCacheUsesToken(action)
        ? tokenFingerprint(bearer)
        : null,
    });

    const t0 = Date.now();
    let upstreamStatus = 0;
    let responseText = "";
    let shared = false;

    if (isCoalescableGasAction(action)) {
      const cached = readGasShortCache(key);
      if (cached) {
        return jsonTextResponse(cached.body, cached.status, { "x-gas-cache": "HIT" });
      }
      const coalesced = await withGasInflightCoalesce(key, async () => {
        const res = await postToGas(gasUrl, request, body, action);
        upstreamStatus = res.status;
        if (!res.parsed) throw new Error("non-JSON GAS body");
        if (gasActionCacheTtlMs(action) > 0) {
          writeGasShortCache(key, res.text, res.status, gasActionCacheTtlMs(action));
        }
        return res.text;
      });
      responseText = coalesced.text;
      shared = coalesced.shared;
      if (!upstreamStatus) upstreamStatus = 200;
    } else {
      const res = await postToGas(gasUrl, request, body, action);
      upstreamStatus = res.status;
      responseText = res.text;
    }

    console.info(
      `[GAS proxy] POST ${action || "bookingSave"} ${Date.now() - t0}ms shared=${shared} bytes=${responseText.length}`
    );

    let result: Record<string, unknown> | null = null;
    try {
      result = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      // Writes are never retried here: the upstream may have applied the change.
      return gasBadResponse("POST", upstreamStatus, responseText);
    }

    if (upstreamStatus >= 200 && upstreamStatus < 300 && shouldInvalidateCache(action, payload)) {
      bumpGasCacheGeneration();
    }

    const isPendingReview =
      payload?.status === BOOKING_STATUS_PENDING_REVIEW ||
      isPendingReviewStatus(String(payload?.status || ""));

    if (
      upstreamStatus >= 200 &&
      upstreamStatus < 300 &&
      result?.success !== false &&
      !result?.error &&
      payload?.source === "Сайт" &&
      isPendingReview &&
      result?.orderId
    ) {
      try {
        const { notifyPendingBookingReview } = await import(
          "@/lib/telegram/bookingReviewNotify"
        );
        await notifyPendingBookingReview({
          orderId: String(result.orderId),
          name: String(payload.name || ""),
          phone: String(payload.phone || ""),
          cottage: String(payload.cottage || ""),
          checkIn: String(payload.checkIn || ""),
          checkOut: String(payload.checkOut || ""),
          guests: Number(payload.guests) || 2,
          totalPrice: Number(payload.totalPrice) || 0,
          prepayAmount: Number(payload.prepayAmount) || Number(result.prepayment) || 0,
          comment: String(payload.comment || ""),
          source: "Сайт",
        });
      } catch (err) {
        console.error("[GAS proxy] notifyPendingBookingReview:", err);
      }
      return NextResponse.json({
        ...result,
        flow: "pending_review",
        paymentData: undefined,
      });
    }

    if (
      upstreamStatus >= 200 &&
      upstreamStatus < 300 &&
      result?.success !== false &&
      !result?.error &&
      payload?.source === "Сайт" &&
      !isPendingReview &&
      result?.orderId
    ) {
      after(async () => {
        try {
          const [{ fetchBookingByDisplayId }, { sendBookingLifecycleSms }, { loadSmsSettingsSystem }] =
            await Promise.all([
              import("@/lib/gas-api"),
              import("@/lib/sms/bookingLifecycleSms"),
              import("@/lib/sms/loadSmsSettings"),
            ]);
          const bookingResult = await fetchBookingByDisplayId(String(result.orderId));
          if (bookingResult.ok && bookingResult.booking) {
            const smsSettings = await loadSmsSettingsSystem();
            await sendBookingLifecycleSms(bookingResult.booking, "payment_link", smsSettings);
          }
        } catch (err) {
          console.error("[GAS proxy] payment link SMS:", err);
        }
      });
    }

    if (
      upstreamStatus >= 200 &&
      upstreamStatus < 300 &&
      result?.success !== false &&
      !result?.error &&
      payload &&
      (payload.action === "createBooking" || (payload.checkIn && payload.name))
    ) {
      after(async () => {
        try {
          await afterBookingTelegramHooks(payload, result || {});
        } catch (err) {
          console.error("[GAS proxy] booking telegram hooks:", err);
        }
      });
    }

    if (upstreamStatus >= 200 && upstreamStatus < 300 && result?.activity && typeof result.activity === "object") {
      after(async () => {
        try {
          const { notifyActivityChange } = await import(
            "@/lib/telegram/activityChangeNotify"
          );
          await notifyActivityChange(
            result.activity as {
              id?: string;
              at?: string;
              type?: string;
              summary?: string;
              actor?: {
                userId?: string;
                name?: string;
                email?: string;
                role?: string;
              };
              details?: {
                orderId?: string;
                name?: string;
                cottage?: string;
                saveKeys?: string[];
                changes?: Array<{ label?: string; from?: string; to?: string }>;
              };
            }
          );
        } catch (err) {
          console.error("[GAS proxy] activity telegram:", err);
        }
      });
    }

    return NextResponse.json(result, { status: upstreamStatus });
  } catch (err) {
    return gasUnreachable("POST", err);
  }
}
