import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/auth/middleware";
import { isMobileUserAgent } from "@/lib/isMobileUserAgent";
import { isMaintenanceMode } from "@/lib/maintenance";

const PUBLIC_HOSTS = new Set(["azhunebi.com", "www.azhunebi.com"]);
const PUBLIC_CANONICAL_HOST = "azhunebi.com";
const ADMIN_HOST = "admin.azhunebi.com";
const AUTH_COOKIE = "gas_auth_token";

function requestHostname(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost?.split(",")[0]?.trim() || request.headers.get("host") || "";
  return host.split(":")[0].toLowerCase();
}

function redirectToHost(request: NextRequest, hostname: string) {
  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.hostname = hostname;
  url.port = "";
  return NextResponse.redirect(url);
}

function redirectToCleanAdminRoot(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.hostname = ADMIN_HOST;
  url.port = "";
  url.pathname = "/";
  url.search = "";
  return NextResponse.redirect(url);
}

function rewriteToMaintenance(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/maintenance";
  url.search = "";
  return NextResponse.rewrite(url);
}

export async function middleware(request: NextRequest) {
  const hostname = requestHostname(request);
  const pathname = request.nextUrl.pathname;

  // Pause public + admin UI (API / cron / webhooks stay up — matcher excludes api).
  if (isMaintenanceMode() && pathname !== "/maintenance") {
    return rewriteToMaintenance(request);
  }

  if (PUBLIC_HOSTS.has(hostname)) {
    // Канонічний сайт без www.
    if (hostname === "www.azhunebi.com") {
      return redirectToHost(request, PUBLIC_CANONICAL_HOST);
    }

    // Адмінка завжди відкривається чистим admin.azhunebi.com без /admin чи /login.
    if (
      pathname === "/login" ||
      pathname === "/admin" ||
      pathname.startsWith("/admin/")
    ) {
      return redirectToCleanAdminRoot(request);
    }
    if (pathname === "/register" || pathname.startsWith("/invite/")) {
      return redirectToHost(request, ADMIN_HOST);
    }

    // Старе пряме посилання очищається до канонічного домену без /book/default.
    if (pathname === "/book/default" || pathname === "/book/default/") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // Красивий публічний URL без /book/default у рядку браузера.
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/book/default";
      return NextResponse.rewrite(url);
    }
  }

  if (hostname === ADMIN_HOST) {
    // Login must stay reachable even with a stale cookie (re-auth after cutover).
    if (pathname === "/login") {
      return updateSession(request);
    }

    // Старі/внутрішні адреси завжди очищаються до admin.azhunebi.com.
    if (
      pathname === "/admin" ||
      pathname === "/admin/" ||
      pathname === "/admin/mobile"
    ) {
      return redirectToCleanAdminRoot(request);
    }

    // На чистому корені внутрішньо показуємо login або потрібну версію адмінки.
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      const hasSession = Boolean(request.cookies.get(AUTH_COOKIE)?.value);

      if (!hasSession) {
        url.pathname = "/login";
        url.searchParams.set("next", "/");
        return NextResponse.rewrite(url);
      }

      const mobile = isMobileUserAgent(request.headers.get("user-agent"));
      const forceDesktop = request.nextUrl.searchParams.get("desktop") === "1";
      const forceMobile = request.nextUrl.searchParams.get("mobile") === "1";
      url.pathname = mobile && !forceDesktop || forceMobile ? "/admin/mobile" : "/admin";
      url.search = "";
      return NextResponse.rewrite(url);
    }

    // Публічні бронювання та оплата не повинні жити на адмінському домені.
    if (
      pathname === "/book" ||
      pathname.startsWith("/book/") ||
      pathname === "/pay" ||
      pathname.startsWith("/pay/")
    ) {
      if (pathname === "/book/default" || pathname === "/book/default/") {
        const url = request.nextUrl.clone();
        url.protocol = "https:";
        url.hostname = PUBLIC_CANONICAL_HOST;
        url.port = "";
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
      return redirectToHost(request, PUBLIC_CANONICAL_HOST);
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\..*).*)",
  ],
};
