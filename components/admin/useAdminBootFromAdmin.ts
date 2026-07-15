"use client";

import { useMemo } from "react";
import { normalizeDriveImageUrl } from "@/lib/driveImageUrl";
import { getCachedTenantLogoUrl } from "@/lib/admin/brandingLogoCache";
import type { AdminSettingsPayload } from "./desktop/types";
import { useAdminBootReport } from "./AdminBootContext";

type AdminBootSource = {
  isLoading: boolean;
  appVisible: boolean;
  loadError: string | null;
  settings: AdminSettingsPayload;
};

export function useAdminBootFromAdmin(admin: AdminBootSource, tenantId?: string | null) {
  const branding = (admin.settings.branding || {}) as Record<string, unknown>;
  const logoUrl = useMemo(() => {
    const fromSettings = normalizeDriveImageUrl(String(branding.logo_url || ""));
    if (fromSettings) return fromSettings;
    return tenantId ? getCachedTenantLogoUrl(tenantId) : null;
  }, [branding.logo_url, tenantId]);

  useAdminBootReport({
    isLoading: admin.isLoading,
    appVisible: admin.appVisible,
    loadError: admin.loadError,
    logoUrl,
  });
}
