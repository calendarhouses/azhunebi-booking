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

  try {
    const upstream = await fetch(gasUrl, {
      method: "POST",
      headers: forwardHeaders(request, "POST"),
      body,
      redirect: "follow",
      cache: "no-store",
    });
    const responseText = await upstream.text();
    let payload: Record<string, unknown> | null = null;
    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      payload = null;
    }

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
        const [{ fetchBookingByDisplayId }, { sendBookingLifecycleSms }] =
          await Promise.all([
            import("@/lib/gas-api"),
            import("@/lib/sms/bookingLifecycleSms"),
          ]);
        const bookingResult = await fetchBookingByDisplayId(String(result.orderId));
        if (bookingResult.ok && bookingResult.booking) {
          await sendBookingLifecycleSms(bookingResult.booking, "payment_link");
        }
        } catch (err) {
          console.error("[GAS proxy] payment link SMS:", err);
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
