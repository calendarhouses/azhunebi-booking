const STORAGE_PREFIX = "khata_onboarding_complete_hidden";

export function getOnboardingDismissKey(tenantId: string): string {
  return `${STORAGE_PREFIX}_${tenantId}`;
}

export function isOnboardingWelcomeHidden(tenantId: string | undefined): boolean {
  if (!tenantId || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(getOnboardingDismissKey(tenantId)) === "1";
  } catch {
    return false;
  }
}

export function hideOnboardingWelcome(tenantId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getOnboardingDismissKey(tenantId), "1");
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearOnboardingWelcomeHidden(tenantId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getOnboardingDismissKey(tenantId));
  } catch {
    /* ignore */
  }
}
