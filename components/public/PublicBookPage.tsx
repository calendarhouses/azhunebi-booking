"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect } from "react";
import type { CSSProperties } from "react";
import type { PublicTenantPayload } from "@/lib/public-booking/types";
import { PublicBookingProvider } from "./PublicBookingProvider";

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
};

function PublicBookPageInner({ data, variant }: Props) {
  const accent = (data.branding.primary_color as string) || "#556B2F";

  useEffect(() => {
    document.body.classList.remove("boso-public-mobile", "boso-public-desktop", "ready");
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
          ["--accent" as string]: accent,
          ["--accent-hover" as string]: "#4B5D28",
        } as CSSProperties
      }
    >
      <PublicBookingProvider data={data}>
        {variant === "mobile" ? <PublicMobileSite /> : <PublicDesktopSite />}
      </PublicBookingProvider>
    </div>
  );
}

export function PublicBookPage(props: Props) {
  return (
    <Suspense fallback={<div className="loading-state">Завантаження...</div>}>
      <PublicBookPageInner {...props} />
    </Suspense>
  );
}
