"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isMobileUserAgent } from "@/lib/isMobileUserAgent";

function shouldBounceToMobileAdmin(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("desktop") === "1") return false;
  return isMobileUserAgent(navigator.userAgent);
}

/**
 * Safety net: if desktop shell somehow loads on a phone (cached URL, bypassed middleware),
 * bounce to the real mobile admin with bottom nav.
 *
 * Returns true when a redirect is in progress — callers must NOT mount useAdminApp
 * (avoids a second full Stage-A GAS burst before /admin/mobile).
 */
export function usePhoneDesktopBounce(): boolean {
  const router = useRouter();
  const bounce = useMemo(() => shouldBounceToMobileAdmin(), []);

  useEffect(() => {
    if (!bounce) return;
    // admin.azhunebi.com: middleware maps "/" → mobile shell by UA.
    // Soft /admin/mobile there redirects back to "/" and can loop.
    if (window.location.hostname === "admin.azhunebi.com") {
      window.location.replace("/");
      return;
    }
    router.replace("/admin/mobile");
  }, [bounce, router]);

  return bounce;
}

/** @deprecated Prefer usePhoneDesktopBounce in a gate that skips heavy boot. */
export function RedirectPhoneToMobileAdmin() {
  usePhoneDesktopBounce();
  return null;
}
