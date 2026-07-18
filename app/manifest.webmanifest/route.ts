import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_HOSTS = new Set(["azhunebi.com", "www.azhunebi.com"]);
const ADMIN_HOST = "admin.azhunebi.com";

function requestHost(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-host");
  const host =
    forwarded?.split(",")[0]?.trim() || request.headers.get("host") || "";
  return host.split(":")[0].toLowerCase();
}

function publicManifest() {
  return {
    id: "/",
    name: "АЖ У НЕБІ",
    short_name: "АЖ У НЕБІ",
    description: "Бронювання котеджів АЖ У НЕБІ",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F5F2",
    theme_color: "#F7F5F2",
    lang: "uk",
    icons: [
      {
        src: "/images/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/logo.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/logo.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

function adminManifest() {
  return {
    id: "/admin",
    name: "Панель Управління — АЖ У НЕБІ",
    short_name: "Адмінка",
    description: "Мобільна панель управління бронюваннями",
    // На admin.azhunebi.com корінь сам відкриває мобільну/десктоп адмінку.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F8F6",
    theme_color: "#556B2F",
    lang: "uk",
    icons: [
      {
        src: "/images/admin-preloader-logo.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/admin-preloader-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/admin-preloader-logo.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

export async function GET(request: Request) {
  const host = requestHost(request);
  const body = PUBLIC_HOSTS.has(host)
    ? publicManifest()
    : host === ADMIN_HOST
      ? adminManifest()
      : publicManifest();

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
