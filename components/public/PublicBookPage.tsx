"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { PublicTenantPayload } from "@/lib/public-booking/types";
import { BrandFavicon } from "@/components/ui/BrandFavicon";
import { PublicBookingProvider } from "./PublicBookingProvider";
import { PublicPreloader } from "./PublicPreloader";

const PUBLIC_BRAND_ACCENT = "#556B2F";
const PUBLIC_BRAND_ACCENT_HOVER = "#4B5D28";
const PUBLIC_BRAND_ACCENT_LIGHT = "rgba(85,107,47,0.08)";

function PublicChunkFallback({
  logoUrl,
  alt,
}: {
  logoUrl?: string | null;
  alt: string;
}) {
  return <PublicPreloader visible logoUrl={logoUrl} alt={alt} />;
}

const PublicDesktopSite = dynamic(
  () => import("./PublicDesktopSite").then((m) => m.PublicDesktopSite),
  { ssr: false, loading: () => null }
);

const PublicMobileSite = dynamic(
  () => import("./PublicMobileSite").then((m) => m.PublicMobileSite),
  { ssr: false, loading: () => null }
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
  const [chunkReady, setChunkReady] = useState(false);
  const siteTitle =
    String(data.branding?.site_title || data.tenantName || "АЖ У НЕБІ").trim() ||
    "АЖ У НЕБІ";
  const logoUrl = (data.branding?.logo_url as string) || null;

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

  useEffect(() => {
    let cancelled = false;
    const markReady = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) setChunkReady(true);
        });
      });
    };
    // Cover the ssr:false dynamic import gap — preloader stays until sites mount.
    void (variant === "mobile"
      ? import("./PublicMobileSite")
      : import("./PublicDesktopSite")
    ).then(markReady, markReady);
    return () => {
      cancelled = true;
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
          background: "#F7F5F2",
          minHeight: "100vh",
        } as CSSProperties
      }
    >
      <PublicBookingProvider data={data} initialInit={initialInit}>
        <BrandFavicon logoUrl={logoUrl} />
        {/* SSR-capable cover: loading.tsx handles server wait; this covers client chunk load. */}
        {!chunkReady ? <PublicChunkFallback logoUrl={logoUrl} alt={siteTitle} /> : null}
        {variant === "mobile" ? <PublicMobileSite /> : <PublicDesktopSite />}
      </PublicBookingProvider>
    </div>
  );
}

export function PublicBookPage(props: Props) {
  const siteTitle =
    String(props.data.branding?.site_title || props.data.tenantName || "АЖ У НЕБІ").trim() ||
    "АЖ У НЕБІ";
  const logoUrl = (props.data.branding?.logo_url as string) || null;
  return (
    <Suspense fallback={<PublicChunkFallback logoUrl={logoUrl} alt={siteTitle} />}>
      <PublicBookPageInner {...props} />
    </Suspense>
  );
}
