import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fetchPublicTenantData } from "@/lib/gas-api";
import { extractDriveFileId, normalizeDriveImageUrl } from "@/lib/driveImageUrl";
import { BRAND_ICON_GREEN, BRAND_ICONS } from "@/lib/brandIcons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK_TRANSPARENT = path.join(
  process.cwd(),
  "public",
  "images",
  "brand-icon-512.png"
);
const FALLBACK_HOME = path.join(
  process.cwd(),
  "public",
  "images",
  "brand-home-icon-512.png"
);

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

async function fetchImageBytes(upstream: string): Promise<Buffer | null> {
  const res = await fetch(upstream, {
    redirect: "follow",
    cache: "no-store",
    headers: { Accept: "image/*" },
  });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function loadLogoBuffer(logoUrl: string, size: number): Promise<Buffer | null> {
  const maxSide = Math.max(size, 512);
  const fileId = extractDriveFileId(normalizeDriveImageUrl(logoUrl));
  if (fileId) {
    const lh3 = await fetchImageBytes(
      `https://lh3.googleusercontent.com/d/${fileId}=s${maxSide}`
    );
    if (lh3) return lh3;
    const thumb = await fetchImageBytes(
      `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=s${maxSide}`
    );
    if (thumb) return thumb;
  }

  if (/^https?:\/\//i.test(logoUrl)) {
    return fetchImageBytes(logoUrl);
  }

  return null;
}

async function composeHomeIcon(logo: Buffer, size: number): Promise<Buffer> {
  const color = parseHexColor(BRAND_ICON_GREEN);
  // Trim baked-in transparent margins so the mark fills more of the plate.
  // ~5% edge keeps a thin green rim without looking tiny on Android/iOS.
  const pad = Math.round(size * 0.05);
  const inner = Math.max(1, size - pad * 2);
  const trimmed = await sharp(logo)
    .trim({ threshold: 8 })
    .png()
    .toBuffer();
  const resized = await sharp(trimmed)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: color,
    },
  })
    .composite([{ input: resized, gravity: "centre" }])
    .png()
    .toBuffer();
}

/**
 * Brand icon for tabs / PWA / home screen.
 * - default: transparent logo (browser tab)
 * - ?home=1: opaque green plate for Android / iOS home-screen shortcuts
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const size = Math.min(1024, Math.max(64, Number(url.searchParams.get("w")) || 512));
  const home = url.searchParams.get("home") === "1";

  try {
    const tenant = await fetchPublicTenantData("default");
    const logoUrl = String(tenant?.branding?.logo_url || "").trim();
    if (logoUrl) {
      const logoBuf = await loadLogoBuffer(logoUrl, size);
      if (logoBuf) {
        const out = home
          ? await composeHomeIcon(logoBuf, size)
          : await sharp(logoBuf)
              .resize(size, size, {
                fit: "contain",
                background: { r: 0, g: 0, b: 0, alpha: 0 },
              })
              .png()
              .toBuffer();

        return new NextResponse(new Uint8Array(out), {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          },
        });
      }
    }
  } catch (err) {
    console.warn("[brand-icon] compose failed", err);
  }

  // Packaged fallbacks
  try {
    const fallbackPath = home ? FALLBACK_HOME : FALLBACK_TRANSPARENT;
    const buf = await sharp(await readFile(fallbackPath))
      .resize(size, size)
      .png()
      .toBuffer();
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.redirect(
      new URL(home ? BRAND_ICONS.home512 : BRAND_ICONS.icon512, request.url),
      302
    );
  }
}
