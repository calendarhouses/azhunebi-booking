import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/auth/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/login", "/register"],
};
