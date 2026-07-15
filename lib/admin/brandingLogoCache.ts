import { normalizeDriveImageUrl } from "@/lib/driveImageUrl";

const KEY_PREFIX = "khata_admin_branding_logo";

export function getCachedTenantLogoUrl(tenantId: string): string | null {
  if (!tenantId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}:${tenantId}`);
    if (!raw) return null;
    return normalizeDriveImageUrl(raw) || null;
  } catch {
    return null;
  }
}

export function setCachedTenantLogoUrl(tenantId: string, url: string | null | undefined): void {
  if (!tenantId || typeof window === "undefined") return;
  try {
    const key = `${KEY_PREFIX}:${tenantId}`;
    const normalized = url ? normalizeDriveImageUrl(url) : "";
    if (!normalized) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, normalized);
  } catch {
    /* ignore quota / private mode */
  }
}
