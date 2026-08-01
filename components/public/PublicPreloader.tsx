"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { toImageDisplaySrc } from "@/lib/driveImageUrl";

const DEFAULT_LOGO_SRC = "/images/brand-icon-512.png";
const DEFAULT_LOGO_ALT = "АЖ У НЕБІ";

type PublicPreloaderProps = {
  visible: boolean;
  logoUrl?: string | null;
  alt?: string | null;
};

/** Inline critical styles — site CSS may not be loaded yet during boot. */
const shellStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  zIndex: 99999,
  background: "#F7F5F2",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "opacity 0.4s ease, visibility 0.4s ease",
};

const logoStyle: CSSProperties = {
  width: 150,
  height: 150,
  objectFit: "contain",
  animation: "publicPreloaderPulse 1.5s ease-in-out infinite",
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

  const src = logoUrl ? toImageDisplaySrc(logoUrl) : DEFAULT_LOGO_SRC;
  const label = String(alt || DEFAULT_LOGO_ALT).trim() || DEFAULT_LOGO_ALT;

  return (
    <div
      id="preloader"
      className={opaque ? undefined : "preloader-hidden"}
      aria-hidden={!opaque}
      role="status"
      aria-label="Завантаження"
      style={{
        ...shellStyle,
        opacity: opaque ? 1 : 0,
        visibility: opaque ? "visible" : "hidden",
        pointerEvents: opaque ? "auto" : "none",
      }}
    >
      <style>{`@keyframes publicPreloaderPulse{0%{transform:scale(1);opacity:1}50%{transform:scale(1.05);opacity:.7}100%{transform:scale(1);opacity:1}}`}</style>
      <div className="pulse-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          className="public-preloader-logo"
          decoding="async"
          referrerPolicy="no-referrer"
          style={logoStyle}
        />
      </div>
    </div>
  );
}
