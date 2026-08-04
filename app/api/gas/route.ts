import { after, NextResponse } from "next/server";
import { BOOKING_STATUS_PENDING_REVIEW, isPendingReviewStatus } from "@/lib/public-booking/bookingReview";
import { handleBackendRequest } from "@/lib/backend/handleBackendRequest";
import type { DispatchResult } from "@/lib/db/dispatch";
import { isSupabaseDataSource } from "@/lib/dataSource";

export const runtime = "nodejs";
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

function extractGasErrorText(html: string): string {
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
  const cellLimit = cleaned.match(
    /Максимал\w+\s+количество\s+символов[^.]{0,80}|Maximum of \d+ characters in a single cell[^.]{0,40}/i
  );
  if (cellLimit) return cellLimit[0].trim();
  return cleaned.slice(0, 600);
}

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

function extractBearer(request: Request): string | null {
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  const gasToken = request.headers.get("x-gas-token")?.trim();
  return gasToken || null;
}

async function requireAdminBearer(request: Request): Promise<NextResponse | null> {
  const token = extractBearer(request);
  if (!token || token.length < 8) {
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

function queryFromUrl(url: URL): Record<string, string> {
  const q: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    q[key] = value;
  });
  return q;
}

async function proxyGas(req: {
  method: "GET" | "POST";
  token: string | null;
  query: Record<string, string>;
  body: Record<string, unknown> | null;
  rawBody?: string;
  request: Request;
}): Promise<DispatchResult> {
  const gasUrl = getGasUrl();
  if (!gasUrl) {
    return {
      status: 500,
      body: {
        error: "SERVER_MISCONFIGURED",
        message: "NEXT_PUBLIC_GAS_URL is not set",
      },
    };
  }

  if (req.method === "GET") {
    const target = new URL(gasUrl);
    for (const [key, value] of Object.entries(req.query)) {
      target.searchParams.set(key, value);
    }
    if (req.token) target.searchParams.set("token", req.token);

    let lastStatus = 0;
    let lastText = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const upstream = await fetch(target.toString(), {
        method: "GET",
        headers: forwardHeaders(req.request, "GET"),
        redirect: "follow",
        cache: "no-store",
        signal: upstreamSignal(),
      });
      const text = await upstream.text();
      lastStatus = upstream.status;
      lastText = text;
      if (text.trim()) {
        try {
          const json = JSON.parse(text) as Record<string, unknown>;
          return { status: upstream.status, body: json };
        } catch {
          // retry
        }
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 700));
    }
    const bad = gasBadResponse("GET", lastStatus, lastText);
    const badJson = (await bad.json()) as Record<string, unknown>;
    return { status: bad.status, body: badJson };
  }

  const upstream = await fetch(gasUrl, {
    method: "POST",
    headers: forwardHeaders(req.request, "POST"),
    body: req.rawBody ?? JSON.stringify(req.body || {}),
    redirect: "follow",
    cache: "no-store",
    signal: upstreamSignal(),
  });
  const responseText = await upstream.text();
  try {
    const json = JSON.parse(responseText) as Record<string, unknown>;
    return { status: upstream.status, body: json };
  } catch {
    const bad = gasBadResponse("POST", upstream.status, responseText);
    const badJson = (await bad.json()) as Record<string, unknown>;
    return { status: bad.status, body: badJson };
  }
}

async function applyPostBookingSideEffects(
  payload: Record<string, unknown> | null,
  result: Record<string, unknown>,
  upstreamOk: boolean
) {
  if (!payload || !upstreamOk) return;
  if (result.success === false || result.error) return;

  const isPendingReview =
    payload.status === BOOKING_STATUS_PENDING_REVIEW ||
    isPendingReviewStatus(String(payload.status || ""));

  if (payload.source === "Сайт" && isPendingReview && result.orderId) {
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
      console.error("[API] notifyPendingBookingReview:", err);
    }
  }

  if (payload.source === "Сайт" && !isPendingReview && result.orderId) {
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
        console.error("[API] payment link SMS:", err);
      }
    });
  }

  if (payload.action === "createBooking" || (payload.checkIn && payload.name)) {
    after(async () => {
      try {
        await afterBookingTelegramHooks(payload, result);
      } catch (err) {
        console.error("[API] booking telegram hooks:", err);
      }
    });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = queryFromUrl(url);
  const token =
    extractBearer(request) ||
    query.token ||
    query.accessToken ||
    null;

  console.info(
    `[API] GET action=${query.action || "(none)"} source=${isSupabaseDataSource() ? "supabase" : "gas"}`
  );

  try {
    const result = await handleBackendRequest(
      { method: "GET", token, query, body: null },
      (req) => proxyGas({ ...req, request })
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    return gasUnreachable("GET", err);
  }
}

export async function POST(request: Request) {
  const bodyText = await request.text();
  let payload: Record<string, unknown> | null = null;
  try {
    payload = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    payload = null;
  }

  const postAction =
    (payload && typeof payload.action === "string" && payload.action) ||
    (payload && payload.checkIn && payload.name ? "createBooking(bare)" : "(none)");
  console.info(
    `[API] POST action=${postAction} source=${isSupabaseDataSource() ? "supabase" : "gas"}`
  );

  try {
    const local = await handleLocalTelegramActions(request, payload);
    if (local) return local;

    const isPublicCreate =
      Boolean(payload) &&
      (payload!.action === "createBooking" ||
        (Boolean(payload!.checkIn) && Boolean(payload!.name))) &&
      String(payload!.source || "") === "Сайт";

    if (isPublicCreate) {
      const { rateLimitPublicBooking } = await import("@/lib/rateLimit");
      const rl = await rateLimitPublicBooking(request, { limit: 8, windowSec: 60 });
      if (!rl.ok) {
        return NextResponse.json(
          {
            error: "RATE_LIMIT",
            message: "Забагато запитів. Спробуйте через хвилину.",
            retryAfterSec: rl.retryAfterSec,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(rl.retryAfterSec),
              "X-RateLimit-Limit": String(rl.limit),
              "X-RateLimit-Remaining": "0",
            },
          }
        );
      }
    }

    const token = extractBearer(request);
    const result = await handleBackendRequest(
      {
        method: "POST",
        token,
        query: {},
        body: payload,
        rawBody: bodyText,
      },
      (req) => proxyGas({ ...req, request })
    );

    const pendingReviewFlow =
      payload?.source === "Сайт" &&
      (payload?.status === BOOKING_STATUS_PENDING_REVIEW ||
        isPendingReviewStatus(String(payload?.status || ""))) &&
      result.body.orderId &&
      result.status < 400 &&
      result.body.success !== false &&
      !result.body.error;

    await applyPostBookingSideEffects(payload, result.body, result.status < 400);

    if (pendingReviewFlow) {
      return NextResponse.json(
        {
          ...result.body,
          flow: "pending_review",
          paymentData: undefined,
        },
        { status: result.status }
      );
    }

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    return gasUnreachable("POST", err);
  }
}
