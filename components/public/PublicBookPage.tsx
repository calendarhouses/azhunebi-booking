"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { PublicTenantPayload } from "@/lib/public-booking/types";
import { isMobileUserAgent } from "@/lib/isMobileUserAgent";
import { BrandFavicon } from "@/components/ui/BrandFavicon";
import { PublicBookingProvider } from "./PublicBookingProvider";

const PUBLIC_BRAND_ACCENT = "#556B2F";
const PUBLIC_BRAND_ACCENT_HOVER = "#4B5D28";
const PUBLIC_BRAND_ACCENT_LIGHT = "rgba(85,107,47,0.08)";
const STYLESHEET_ATTR = "data-public-site-css";

const PublicDesktopSite = dynamic(
  () => import("./PublicDesktopSite").then((m) => m.PublicDesktopSite),
  { ssr: false }
);

const PublicMobileSite = dynamic(
  () => import("./PublicMobileSite").then((m) => m.PublicMobileSite),
  { ssr: false }
);

type PublicVariant = "desktop" | "mobile";

type Props = {
  data: PublicTenantPayload;
  /** Optional SSR hint; when omitted, client detects UA (needed for ISR). */
  variant?: PublicVariant;
};

function ensurePublicStylesheet(variant: PublicVariant) {
  const href =
    variant === "mobile" ? "/public-site-mobile.css" : "/public-site-desktop.css";
  const existing = document.querySelector<HTMLLinkElement>(`link[${STYLESHEET_ATTR}]`);
  if (existing) {
    if (existing.getAttribute("href") === href) return;
    existing.setAttribute("href", href);
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute(STYLESHEET_ATTR, "1");
  document.head.appendChild(link);
}

function PublicBookPageInner({ data, variant: variantProp }: Props) {
  const [variant, setVariant] = useState<PublicVariant | null>(
    variantProp ?? null
  );

  useLayoutEffect(() => {
    const next: PublicVariant =
      variantProp ??
      (isMobileUserAgent(navigator.userAgent) ? "mobile" : "desktop");
    setVariant(next);
    ensurePublicStylesheet(next);
  }, [variantProp]);

  useEffect(() => {
    if (!variant) return;
    document.body.classList.remove("boso-public-mobile", "boso-public-desktop");
    document.body.classList.add(
      variant === "mobile" ? "boso-public-mobile" : "boso-public-desktop"
    );
    return () => {
      document.body.classList.remove("boso-public-mobile", "boso-public-desktop", "ready");
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [variant]);

  if (!variant) {
    return <div className="loading-state">Завантаження…</div>;
  }

  return (
    <div
      className={`public-book-root boso-public-body ${variant === "mobile" ? "boso-public-mobile" : "boso-public-desktop"}`}
      style={
        {
          ["--accent" as string]: PUBLIC_BRAND_ACCENT,
          ["--accent-hover" as string]: PUBLIC_BRAND_ACCENT_HOVER,
          ["--accent-light" as string]: PUBLIC_BRAND_ACCENT_LIGHT,
        } as CSSProperties
      }
    >
      <PublicBookingProvider data={data}>
        <BrandFavicon logoUrl={(data.branding?.logo_url as string) || null} />
        {variant === "mobile" ? <PublicMobileSite /> : <PublicDesktopSite />}
      </PublicBookingProvider>
    </div>
  );
}

export function PublicBookPage(props: Props) {
  return (
    <Suspense fallback={<div className="loading-state">Завантаження…</div>}>
      <PublicBookPageInner {...props} />
    </Suspense>
  );
}
