import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/auth/middleware";

const PUBLIC_HOSTS = new Set(["azhunebi.com", "www.azhunebi.com"]);
const PUBLIC_CANONICAL_HOST = "www.azhunebi.com";
const ADMIN_HOST = "admin.azhunebi.com";

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

export async function middleware(request: NextRequest) {
  const hostname = requestHostname(request);
  const pathname = request.nextUrl.pathname;

  if (PUBLIC_HOSTS.has(hostname)) {
    // Адмінські сторінки завжди мають одну адресу й одні cookies авторизації.
    if (
      pathname === "/login" ||
      pathname === "/register" ||
      pathname === "/admin" ||
      pathname.startsWith("/admin/")
    ) {
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
    // Вхід на admin.azhunebi.com одразу відкриває адмінку.
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Публічні бронювання та оплата не повинні жити на адмінському домені.
    if (
      pathname === "/book" ||
      pathname.startsWith("/book/") ||
      pathname === "/pay" ||
      pathname.startsWith("/pay/")
    ) {
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
