import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FILE_ID_RE = /^[a-zA-Z0-9_-]+$/;

function lh3Url(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}=w1920`;
}

function thumbnailUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1920`;
}

async function fetchImage(upstream: string): Promise<Response> {
  return fetch(upstream, {
    redirect: "follow",
    cache: "force-cache",
    headers: {
      Accept: "image/*",
    },
  });
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id || !FILE_ID_RE.test(id)) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  let upstream = await fetchImage(lh3Url(id));
  if (!upstream.ok) {
    upstream = await fetchImage(thumbnailUrl(id));
  }
  if (!upstream.ok) {
    return NextResponse.json({ error: "IMAGE_NOT_FOUND" }, { status: upstream.status || 502 });
  }

  const contentType = upstream.headers.get("content-type") || "image/png";
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
