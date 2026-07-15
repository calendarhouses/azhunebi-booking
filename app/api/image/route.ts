import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FILE_ID_RE = /^[a-zA-Z0-9_-]+$/;

function lh3Url(fileId: string, maxSide: number): string {
  // =s — вписати в квадрат maxSide×maxSide без обрізки (зберігає пропорції)
  return `https://lh3.googleusercontent.com/d/${fileId}=s${maxSide}`;
}

function thumbnailUrl(fileId: string, maxSide: number): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=s${maxSide}`;
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
  const params = new URL(request.url).searchParams;
  const id = params.get("id")?.trim();
  const widthParam = params.get("w")?.trim();
  const width =
    widthParam && /^\d+$/.test(widthParam)
      ? Math.min(Math.max(parseInt(widthParam, 10), 320), 1920)
      : 1920;

  if (!id || !FILE_ID_RE.test(id)) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  let upstream = await fetchImage(lh3Url(id, width));
  if (!upstream.ok) {
    upstream = await fetchImage(thumbnailUrl(id, width));
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
