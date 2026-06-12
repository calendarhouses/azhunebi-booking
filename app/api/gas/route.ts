import { NextResponse } from "next/server";

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
