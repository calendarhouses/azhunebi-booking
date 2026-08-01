import { after, NextResponse } from "next/server";
import { BOOKING_STATUS_PENDING_REVIEW, isPendingReviewStatus } from "@/lib/public-booking/bookingReview";

export const runtime = "nodejs";
// GAS queues under load (cron + cold start) often take 40-70s; the platform
// default would kill the request mid-flight and surface as a hard failure.
export const maxDuration = 120;

const GAS_UPSTREAM_TIMEOUT_MS = 90_000;

/** In-flight coalescing for public reads — no stale cache, just one live call. */
const inflightPublicGets = new Map<string, Promise<{ status: number; text: string }>>();

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
    // Cache-busting query params must not break coalescing keys.
    if (key === "t" || key === "_") return;
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
  const tenantId = target.searchParams.get("tenant_id") || "";
  const canCoalesce =
    !bearer &&
    !token &&
    (action === "initData" || action === "fetchPublicTenant") &&
    Boolean(tenantId);
  const coalesceKey = canCoalesce ? `${action}:${tenantId}` : "";

  const fetchUpstreamJson = async (): Promise<{ status: number; text: string }> => {
    let lastStatus = 0;
    let lastText = "";
    // Google intermittently returns an HTML 404 after a long queue wait.
    // One retry usually clears it once the script wakes up.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
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
        if (text.trim()) {
          try {
            JSON.parse(text);
            return { status: upstream.status, text };
          } catch {
            // HTML / truncated body — retry
          }
        }
      } catch (err) {
        if (attempt === 1) throw err;
      }
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
    return { status: lastStatus, text: lastText };
  };

  try {
    let result: { status: number; text: string };
    if (coalesceKey) {
      const existing = inflightPublicGets.get(coalesceKey);
      if (existing) {
        result = await existing;
      } else {
        const pending = fetchUpstreamJson().finally(() => {
          inflightPublicGets.delete(coalesceKey);
        });
        inflightPublicGets.set(coalesceKey, pending);
        result = await pending;
      }
    } else {
      result = await fetchUpstreamJson();
    }

    if (result.text.trim()) {
      try {
        JSON.parse(result.text);
        return new NextResponse(result.text, {
          status: result.status,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      } catch {
        // fall through
      }
    }
    return gasBadResponse("GET", result.status, result.text);
  } catch (err) {
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

    const upstream = await fetch(gasUrl, {
      method: "POST",
      headers: forwardHeaders(request, "POST"),
      body,
      redirect: "follow",
      cache: "no-store",
      signal: upstreamSignal(),
    });
    const responseText = await upstream.text();

    let result: Record<string, unknown> | null = null;
    try {
      result = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      // Writes are never retried here: the upstream may have applied the change.
      return gasBadResponse("POST", upstream.status, responseText);
    }

    const isPendingReview =
      payload?.status === BOOKING_STATUS_PENDING_REVIEW ||
      isPendingReviewStatus(String(payload?.status || ""));

    if (
      upstream.ok &&
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
      upstream.ok &&
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
      upstream.ok &&
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

    if (upstream.ok && result?.activity && typeof result.activity === "object") {
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

    return NextResponse.json(result, { status: upstream.status });
  } catch (err) {
    return gasUnreachable("POST", err);
  }
}
