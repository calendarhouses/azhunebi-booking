"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AdminPreloader } from "./AdminPreloader";
import { useAdminBootState } from "./AdminBootContext";
import {
  ADMIN_PRELOADER_LOGO_ALT,
  ADMIN_PRELOADER_LOGO_SRC,
} from "@/lib/admin/adminPreloaderLogo";

/** Absolute ceiling — the preloader must never be the final state of the page. */
const MAX_PRELOADER_MS = 95_000;

export function AdminBootPreloader() {
  const { loading: authLoading, error, ready, membership, preloaderLogoUrl } = useAuth();
  const boot = useAdminBootState();

  const authBlocked = !authLoading && (!ready || !!error);
  const bootError = Boolean(boot.loadError) && !boot.appVisible && !boot.isLoading;
  // Once the app shell is visible, never cover it again — background sync can
  // finish quietly. The old `isLoading || !appVisible` rule re-trapped users
  // behind a 30–90s blank screen whenever GAS queued.
  const wantsPreloader =
    !authBlocked && !bootError && !boot.appVisible && (authLoading || boot.isLoading);

  const [timedOut, setTimedOut] = useState(false);
  const wantsRef = useRef(wantsPreloader);
  wantsRef.current = wantsPreloader;

  useEffect(() => {
    if (!wantsPreloader) {
      setTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => {
      if (wantsRef.current) setTimedOut(true);
    }, MAX_PRELOADER_MS);
    return () => window.clearTimeout(timer);
  }, [wantsPreloader]);

  const alt = membership?.tenantName || ADMIN_PRELOADER_LOGO_ALT;

  if (wantsPreloader && timedOut) {
    return <BootStalledScreen />;
  }

  return (
    <AdminPreloader
      visible={wantsPreloader}
      logoUrl={preloaderLogoUrl || ADMIN_PRELOADER_LOGO_SRC}
      alt={alt}
    />
  );
}

function BootStalledScreen() {
  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#F3F4F6",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          background: "#fff",
          borderRadius: 16,
          padding: 32,
          border: "1px solid #E5E7EB",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 19, fontWeight: 700, marginBottom: 10, color: "#111827" }}>
          Дані завантажуються надто довго
        </h1>
        <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
          Google Таблиця відповідає повільно. Спробуйте ще раз — зазвичай друга спроба
          проходить швидко.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: "12px 24px",
            background: "#556B2F",
            color: "#fff",
            border: 0,
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Оновити
        </button>
      </div>
    </div>
  );
}
