"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { computeOnboardingProgress } from "@/lib/admin/onboarding/computeOnboardingProgress";
import type { AdminSettingsPayload } from "@/components/admin/desktop/types";
import { OnboardingWidget } from "./OnboardingWidget";
import { OnboardingWelcomeBanner } from "./OnboardingWelcomeBanner";
import {
  hideOnboardingWelcome,
  isOnboardingWelcomeHidden,
} from "./onboarding-storage";

export type AdminOnboardingSectionProps = {
  settings: AdminSettingsPayload;
  tenantId?: string;
  tenantName?: string | null;
  bookingsCount: number;
  publicBookUrl?: string;
  onSettingsChange: (next: AdminSettingsPayload) => void;
  onLogoPreviewChange?: (nextUrl: string | null) => void;
};

export function AdminOnboardingSection({
  settings,
  tenantId,
  tenantName,
  bookingsCount,
  publicBookUrl,
  onSettingsChange,
  onLogoPreviewChange,
}: AdminOnboardingSectionProps) {
  const roomsCount = settings.roomsList?.length ?? 0;
  const progress = useMemo(
    () => computeOnboardingProgress({ settings, tenantName }),
    [settings, tenantName]
  );

  const [welcomeHidden, setWelcomeHidden] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    setWelcomeHidden(isOnboardingWelcomeHidden(tenantId));
  }, [tenantId]);

  const handleDismissWelcome = useCallback(() => {
    if (tenantId) hideOnboardingWelcome(tenantId);
    setWelcomeHidden(true);
  }, [tenantId]);

  if (roomsCount === 0) {
    return (
      <OnboardingWidget
        settings={settings}
        tenantName={tenantName}
        onSettingsChange={onSettingsChange}
      onLogoPreviewChange={onLogoPreviewChange}
      />
    );
  }

  if (progress.isComplete) {
    if (welcomeHidden) return null;
    return (
      <OnboardingWelcomeBanner
        tenantName={tenantName}
        roomsCount={roomsCount}
        bookingsCount={bookingsCount}
        publicBookUrl={publicBookUrl}
        onDismiss={handleDismissWelcome}
      />
    );
  }

  return (
    <OnboardingWidget
      settings={settings}
      tenantName={tenantName}
      onSettingsChange={onSettingsChange}
      onLogoPreviewChange={onLogoPreviewChange}
    />
  );
}
