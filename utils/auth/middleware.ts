import { type NextRequest, NextResponse } from "next/server";
import { isMobileUserAgent } from "@/lib/isMobileUserAgent";

const AUTH_COOKIE = "gas_auth_token";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdmin = pathname.startsWith("/admin");
  const isLogin = pathname === "/login";
  const isRegister = pathname === "/register";
  const hasSession = Boolean(request.cookies.get(AUTH_COOKIE)?.value);
  const ua = request.headers.get("user-agent");
  const mobileUa = isMobileUserAgent(ua);
  const forceDesktop = request.nextUrl.searchParams.get("desktop") === "1";
  const forceMobile = request.nextUrl.searchParams.get("mobile") === "1";

  if (isAdmin && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // After login, send phones to mobile shell (bottom nav), not desktop sidebar.
    const nextPath =
      mobileUa && (pathname === "/admin" || pathname === "/admin/")
        ? "/admin/mobile"
        : pathname;
    url.searchParams.set("next", nextPath);
    return NextResponse.redirect(url);
  }

  if ((isLogin || isRegister) && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = mobileUa ? "/admin/mobile" : "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Phone opens /admin → real mobile admin (bottom nav), not squeezed desktop sidebar.
  if (
    hasSession &&
    (pathname === "/admin" || pathname === "/admin/") &&
    mobileUa &&
    !forceDesktop
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/mobile";
    url.searchParams.delete("desktop");
    return NextResponse.redirect(url);
  }

  // Desktop opens /admin/mobile → desktop shell (unless ?mobile=1).
  if (
    hasSession &&
    pathname === "/admin/mobile" &&
    !mobileUa &&
    !forceMobile
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.searchParams.delete("mobile");
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}
