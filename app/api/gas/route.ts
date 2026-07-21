import { after, NextResponse } from "next/server";
import { BOOKING_STATUS_PENDING_REVIEW, isPendingReviewStatus } from "@/lib/public-booking/bookingReview";

export const runtime = "nodejs";

function getGasUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_GAS_URL?.trim();
  return url || null;
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

function passthroughResponse(upstream: Response): NextResponse {
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
    },
  });
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

  try {
    const upstream = await fetch(target.toString(), {
      method: "GET",
      headers: forwardHeaders(request, "GET"),
      redirect: "follow",
      cache: "no-store",
    });
    return passthroughResponse(upstream);
  } catch (err) {
    return NextResponse.json(
      {
        error: "GAS_UNREACHABLE",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
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
    });
    const responseText = await upstream.text();

    let result: Record<string, unknown> | null = null;
    try {
      result = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      return new NextResponse(responseText, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
        },
      });
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

    return NextResponse.json(result, { status: upstream.status });
  } catch (err) {
    return NextResponse.json(
      {
        error: "GAS_UNREACHABLE",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
