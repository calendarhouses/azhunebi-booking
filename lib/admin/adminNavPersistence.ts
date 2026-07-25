import type { AdminViewName, SettingsTabName } from "@/components/admin/desktop/types";

const PREFIX = "khata_admin_nav";

export type PersistedAdminNav = {
  activeView: AdminViewName;
  settingsTab: SettingsTabName;
  settingsExpanded: boolean;
  sidebarCollapsed?: boolean;
  gridFocusMode?: boolean;
};

const VALID_VIEWS: AdminViewName[] = ["list", "grid", "guests", "reports", "settings"];
const VALID_TABS: SettingsTabName[] = [
  "branding",
  "rooms",
  "prices",
  "discounts",
  "restrictions",
  "services",
  "sms",
  "team",
];

function storageKey(tenantId: string) {
  return `${PREFIX}:${tenantId}`;
}

export function loadAdminNav(tenantId: string): PersistedAdminNav | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedAdminNav>;
    if (!parsed.activeView || !VALID_VIEWS.includes(parsed.activeView)) return null;
    const settingsTab =
      parsed.settingsTab && VALID_TABS.includes(parsed.settingsTab)
        ? parsed.settingsTab
        : "rooms";
    return {
      activeView: "grid",
      settingsTab,
      settingsExpanded: !!parsed.settingsExpanded,
      sidebarCollapsed: !!parsed.sidebarCollapsed,
      gridFocusMode: !!parsed.gridFocusMode,
    };
  } catch {
    return null;
  }
}

export function saveAdminNav(tenantId: string, nav: PersistedAdminNav) {
  if (typeof window === "undefined") return;
  try {
    const prev = loadAdminNav(tenantId);
    sessionStorage.setItem(
      storageKey(tenantId),
      JSON.stringify({
        ...nav,
        sidebarCollapsed: nav.sidebarCollapsed ?? prev?.sidebarCollapsed ?? false,
        gridFocusMode: nav.gridFocusMode ?? prev?.gridFocusMode ?? false,
      })
    );
  } catch {
    /* ignore quota */
  }
}

export function patchAdminNav(tenantId: string, patch: Partial<PersistedAdminNav>) {
  const current = loadAdminNav(tenantId);
  saveAdminNav(tenantId, {
    activeView: current?.activeView ?? "grid",
    settingsTab: current?.settingsTab ?? "rooms",
    settingsExpanded: current?.settingsExpanded ?? false,
    sidebarCollapsed: current?.sidebarCollapsed ?? false,
    gridFocusMode: current?.gridFocusMode ?? false,
    ...patch,
  });
}

export function clearAdminNav(tenantId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(tenantId));
  } catch {
    /* ignore */
  }
}
