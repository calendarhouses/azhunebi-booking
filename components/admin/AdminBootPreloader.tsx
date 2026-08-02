"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { AdminPreloader } from "./AdminPreloader";
import { useAdminBootState } from "./AdminBootContext";
import {
  ADMIN_PRELOADER_LOGO_ALT,
  ADMIN_PRELOADER_LOGO_SRC,
} from "@/lib/admin/adminPreloaderLogo";

export function AdminBootPreloader() {
  const { loading: authLoading, error, ready, membership, preloaderLogoUrl } = useAuth();
  const boot = useAdminBootState();

  const authBlocked = !authLoading && !ready;
  const bootError = Boolean(boot.loadError) && !boot.appVisible && !boot.isLoading;
  const visible =
    !authBlocked && !bootError && (authLoading || boot.isLoading || !boot.appVisible);

  const alt = membership?.tenantName || ADMIN_PRELOADER_LOGO_ALT;

  return (
    <AdminPreloader visible={visible} logoUrl={preloaderLogoUrl || ADMIN_PRELOADER_LOGO_SRC} alt={alt} />
  );
}
