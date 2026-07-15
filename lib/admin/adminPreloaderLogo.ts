/** Статичний логотип прелоадера адмінки (без брендингу ХАТА). */
export const ADMIN_PRELOADER_LOGO_SRC = "/images/admin-preloader-logo.png";
export const ADMIN_PRELOADER_LOGO_ALT = "АЖ У НЕБІ";
/** Єдиний розмір логотипу на прелоадері (px). */
export const ADMIN_PRELOADER_LOGO_SIZE_PX = 150;

const LAST_TENANT_KEY = "khata_admin_last_tenant_id";

export function getLastAdminTenantId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LAST_TENANT_KEY);
  } catch {
    return null;
  }
}

export function setLastAdminTenantId(tenantId: string): void {
  if (typeof window === "undefined" || !tenantId) return;
  try {
    localStorage.setItem(LAST_TENANT_KEY, tenantId);
  } catch {
    /* ignore */
  }
}

export function resolveAdminPreloaderLogoUrl(cachedLogoUrl?: string | null): string {
  return cachedLogoUrl || ADMIN_PRELOADER_LOGO_SRC;
}
