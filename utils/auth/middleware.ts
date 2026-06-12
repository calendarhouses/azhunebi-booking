import { type NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "gas_auth_token";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdmin = pathname.startsWith("/admin");
  const isLogin = pathname === "/login";
  const isRegister = pathname === "/register";
  const hasSession = Boolean(request.cookies.get(AUTH_COOKIE)?.value);

  if (isAdmin && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if ((isLogin || isRegister) && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}
