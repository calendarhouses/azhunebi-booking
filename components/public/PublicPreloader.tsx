"use client";

import { useEffect, useState } from "react";
import { toImageDisplaySrc } from "@/lib/driveImageUrl";

const DEFAULT_LOGO_SRC = "/images/brand-icon-512.png";
const DEFAULT_LOGO_ALT = "АЖ У НЕБІ";

type PublicPreloaderProps = {
  visible: boolean;
  logoUrl?: string | null;
  alt?: string | null;
};

export function PublicPreloader({ visible, logoUrl, alt }: PublicPreloaderProps) {
  const [mounted, setMounted] = useState(visible);
  const [opaque, setOpaque] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setOpaque(true);
      return;
    }

    setOpaque(false);
    const timer = window.setTimeout(() => setMounted(false), 420);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!mounted) return null;

  const src = logoUrl ? toImageDisplaySrc(logoUrl, 480) : DEFAULT_LOGO_SRC;
  const label = String(alt || DEFAULT_LOGO_ALT).trim() || DEFAULT_LOGO_ALT;

  return (
    <div
      id="preloader"
      className={opaque ? undefined : "preloader-hidden"}
      aria-hidden={!opaque}
      role="status"
      aria-label="Завантаження"
    >
      <div className="pulse-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          className="public-preloader-logo"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
