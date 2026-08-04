"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { AdminPreloader } from "./AdminPreloader";
import { useAdminBootState } from "./AdminBootContext";
import {
  ADMIN_PRELOADER_LOGO_ALT,
  ADMIN_PRELOADER_LOGO_SRC,
} from "@/lib/admin/adminPreloaderLogo";

export function AdminBootPreloader() {
  const { loading: authLoading, error, ready } = useAuth();
  const boot = useAdminBootState();

  const authBlocked = !authLoading && (!ready || !!error);
  const bootError = Boolean(boot.loadError) && !boot.appVisible && !boot.isLoading;
  const visible =
    !authBlocked && !bootError && (authLoading || boot.isLoading || !boot.appVisible);

  // Always the static АЖ У НЕБІ mark — never swap to cached tenant branding mid-boot
  // (that flash looked like two preloaders / two logos).
  return (
    <AdminPreloader
      visible={visible}
      logoUrl={ADMIN_PRELOADER_LOGO_SRC}
      alt={ADMIN_PRELOADER_LOGO_ALT}
    />
  );
}
