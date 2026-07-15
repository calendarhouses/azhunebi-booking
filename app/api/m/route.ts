import { NextResponse } from "next/server";
import { buildMessengerLinks, normalizeGuestPhone } from "@/lib/admin/guestMessengerLinks";

export const runtime = "nodejs";

/** Редірект на viber:// (Telegram приймає лише http(s) у inline-кнопках). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("target");
  const phone = normalizeGuestPhone(url.searchParams.get("phone") || "");
  const text = url.searchParams.get("text") || "";

  if (target === "viber" && phone) {
    const viberUrl = buildMessengerLinks(phone, text).viber;
    return NextResponse.redirect(viberUrl);
  }

  return new NextResponse("Not found", { status: 404 });
}
