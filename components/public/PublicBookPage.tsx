"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect } from "react";
import type { CSSProperties } from "react";
import type { PublicTenantPayload } from "@/lib/public-booking/types";
import { BrandFavicon } from "@/components/ui/BrandFavicon";
import { PublicBookingProvider } from "./PublicBookingProvider";

const PUBLIC_BRAND_ACCENT = "#556B2F";
const PUBLIC_BRAND_ACCENT_HOVER = "#4B5D28";
const PUBLIC_BRAND_ACCENT_LIGHT = "rgba(85,107,47,0.08)";

const PublicDesktopSite = dynamic(
  () => import("./PublicDesktopSite").then((m) => m.PublicDesktopSite),
  { ssr: false }
);

const PublicMobileSite = dynamic(
  () => import("./PublicMobileSite").then((m) => m.PublicMobileSite),
  { ssr: false }
);

type Props = {
  data: PublicTenantPayload;
  variant: "desktop" | "mobile";
  initialInit?: {
    settings?: import("@/components/admin/desktop/types").AdminSettingsPayload;
    bookings?: import("@/components/admin/desktop/types").BookingRecord[];
  } | null;
};

function PublicBookPageInner({ data, variant, initialInit }: Props) {
  useEffect(() => {
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
      <PublicBookingProvider data={data} initialInit={initialInit}>
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
