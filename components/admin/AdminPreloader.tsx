"use client";

import { useEffect, useState } from "react";
import { AdminLogo } from "./desktop/AdminLogo";
import "./admin-preloader.css";

type AdminPreloaderProps = {
  visible: boolean;
  logoUrl?: string | null;
  alt?: string | null;
};

export function AdminPreloader({ visible, logoUrl, alt }: AdminPreloaderProps) {
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

  return (
    <div
      id="preloader"
      className={opaque ? undefined : "preloader-hidden"}
      aria-hidden={!opaque}
      role="status"
      aria-label="Завантаження"
    >
      <div className="pulse-logo">
        <AdminLogo variant="preloader" logoUrl={logoUrl} alt={alt} />
      </div>
    </div>
  );
}
