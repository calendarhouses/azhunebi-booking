"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isMobileUserAgent } from "@/lib/isMobileUserAgent";

/**
 * Safety net: if desktop shell somehow loads on a phone (cached URL, bypassed middleware),
 * bounce to the real mobile admin with bottom nav.
 */
export function RedirectPhoneToMobileAdmin() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("desktop") === "1") return;
    if (!isMobileUserAgent(navigator.userAgent)) return;
    router.replace("/admin/mobile");
  }, [router]);

  return null;
}
