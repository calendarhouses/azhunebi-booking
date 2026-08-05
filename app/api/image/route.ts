import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FILE_ID_RE = /^[a-zA-Z0-9_-]+$/;

/** Discrete widths only — stops cache fragmentation from arbitrary `w=` values. */
const WIDTH_BUCKETS = [480, 720, 1080] as const;

function snapWidth(raw: number): number {
  for (const bucket of WIDTH_BUCKETS) {
    if (raw <= bucket) return bucket;
  }
  return WIDTH_BUCKETS[WIDTH_BUCKETS.length - 1];
}

function lh3Url(fileId: string, maxSide: number): string {
  // =s — fit inside maxSide×maxSide without crop
  return `https://lh3.googleusercontent.com/d/${fileId}=s${maxSide}`;
}

function thumbnailUrl(fileId: string, maxSide: number): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=s${maxSide}`;
}

async function fetchImage(upstream: string): Promise<Response> {
  return fetch(upstream, {
    redirect: "follow",
    cache: "force-cache",
    next: { revalidate: 31536000 },
    headers: {
      Accept: "image/*",
    },
  });
}

const YEAR_CACHE =
  "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400, immutable";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id")?.trim();
  const widthParam = params.get("w")?.trim();
  const widthRaw =
    widthParam && /^\d+$/.test(widthParam)
      ? Math.min(Math.max(parseInt(widthParam, 10), 320), 1080)
      : 720;
  const width = snapWidth(widthRaw);

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

  const contentType = upstream.headers.get("content-type") || "image/webp";
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": YEAR_CACHE,
      "CDN-Cache-Control": YEAR_CACHE,
      "Vercel-CDN-Cache-Control": YEAR_CACHE,
      // Help browsers/CDNs key on snapped width only.
      Vary: "Accept",
    },
  });
}
