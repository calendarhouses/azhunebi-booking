"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  expireAdminSession,
  isAdminUnauthorizedError,
} from "@/lib/admin/adminSession";
import { loadAdminNav, saveAdminNav } from "@/lib/admin/adminNavPersistence";
import { parseAdminFetchError } from "@/lib/admin/parseAdminApiError";
import { setCachedTenantLogoUrl } from "@/lib/admin/brandingLogoCache";
import { setLastAdminTenantId } from "@/lib/admin/adminPreloaderLogo";
import {
  consumePrefetchedAdminInit,
} from "@/lib/admin/adminInitPrefetch";
import { normalizeDriveImageUrl } from "@/lib/driveImageUrl";
import { useAuth } from "@/components/auth/AuthProvider";
import { canAccessReports, canAccessSettings } from "@/lib/admin/permissions";
import { isRoomDraftId } from "@/lib/admin/roomDraft";
import { isDiscountDraftId, dedupeDiscountsList } from "@/lib/admin/discountDraft";
import {
  filterPendingDeletedDiscounts,
  reconcilePendingDeletedDiscounts,
} from "@/lib/admin/discountPendingDeletes";
import { fetchAdminInitData, fetchAdminGuestProfiles, silentSyncAdminData } from "./adminApi";
import { mergeBookingsWithPending } from "./bookingUtils";
import { PAGE_TITLES, showToast, syncLegacyGlobals } from "./adminGlobals";
import { getSettingsTabPageMeta } from "./settingsTabMeta";
import type {
  AdminInitResponse,
  AdminSettingsPayload,
  AdminViewName,
  BookingRecord,
  SettingsTabName,
} from "./types";
import { bosoLeave } from "./adminTooltip";
import { syncLegacyAdminViewDom } from "./adminViewDom";
import { syncMobileAdminViewDom } from "../mobile/adminMobileViewDom";

/** Legacy «activity» tab now lives inside Команда. */
function normalizeSettingsTab(tab: SettingsTabName | string | null | undefined): SettingsTabName {
  if (tab === "activity") return "team";
  // Legacy tab removed — redirect saved nav to rooms.
  if (tab === "channels") return "rooms";
  const allowed: SettingsTabName[] = [
    "branding",
    "rooms",
    "prices",
    "discounts",
    "restrictions",
    "services",
    "sms",
    "team",
  ];
  if (tab && (allowed as string[]).includes(tab)) return tab as SettingsTabName;
  return "rooms";
}

/** Лише дані з API — без dummy fallback. */
function mergeGuestProfiles(
  server: AdminSettingsPayload["guestProfiles"],
  local: AdminSettingsPayload["guestProfiles"]
): AdminSettingsPayload["guestProfiles"] {
  const serverMap =
    server && typeof server === "object" && !Array.isArray(server) ? server : null;
  const localMap =
    local && typeof local === "object" && !Array.isArray(local) ? local : null;
  if (!serverMap && !localMap) return undefined;
  if (!serverMap) return localMap || undefined;
  if (!localMap) return serverMap;

  const out: NonNullable<AdminSettingsPayload["guestProfiles"]> = { ...serverMap };
  for (const [phone, profile] of Object.entries(localMap)) {
    if (!profile || typeof profile !== "object") continue;
    const existing = out[phone];
    if (!existing) {
      out[phone] = profile;
      continue;
    }
    const localTs = Date.parse(String(profile.updatedAt || "")) || 0;
    const serverTs = Date.parse(String(existing.updatedAt || "")) || 0;
    if (localTs >= serverTs) out[phone] = profile;
  }
  return out;
}

function mergeSettings(raw: AdminSettingsPayload | undefined): AdminSettingsPayload {
  const s = raw || {};
  return {
    roomsList: Array.isArray(s.roomsList) ? s.roomsList : [],
    discountsList: Array.isArray(s.discountsList) ? s.discountsList : [],
    customServicesList: Array.isArray(s.customServicesList) ? s.customServicesList : [],
    flexibleScheduleSettings: s.flexibleScheduleSettings,
    sysServicesList: Array.isArray(s.sysServicesList) ? s.sysServicesList : [],
    customPrices: s.customPrices && typeof s.customPrices === "object" ? s.customPrices : {},
    restrictions: s.restrictions && typeof s.restrictions === "object" ? s.restrictions : {},
    closedDates: s.closedDates && typeof s.closedDates === "object" ? s.closedDates : {},
    transactions: Array.isArray(s.transactions) ? s.transactions : [],
    branding: s.branding,
    smsSettings: s.smsSettings,
    icalSyncSettings: s.icalSyncSettings,
    guestProfiles:
      s.guestProfiles && typeof s.guestProfiles === "object" && !Array.isArray(s.guestProfiles)
        ? s.guestProfiles
        : undefined,
  };
}

function refreshLegacyView(view: AdminViewName) {
  if (typeof window === "undefined") return;
  if (view === "reports") {
    window.calculateAnalytics?.();
  } else if (view === "settings") {
    const tab = window.__adminSettingsTab as SettingsTabName | undefined;
    if (tab === "restrictions") window.scrollToRestrictionsGrid?.();
    else if (tab === "prices") window.renderPriceGrid?.();
  }
}

declare global {
  interface Window {
    __adminSettingsTab?: SettingsTabName;
    resetGuestFilter?: () => void;
    switchReportTab?: (tab: string, el?: Element | null) => void;
    renderSettingsRooms?: () => void;
    renderPriceGrid?: () => void;
    renderRestrictionsGrid?: () => void;
    scrollToRestrictionsGrid?: () => void;
    renderSettingsDiscounts?: () => void;
    renderSettingsServices?: () => void;
  }
}

export type AdminAppPlatform = "desktop" | "mobile";

export function useAdminApp(options?: {
  platform?: AdminAppPlatform;
  /** Якщо true — не перезаписувати локальний стан з сервера (редагування житла тощо) */
  pauseSilentSyncRef?: MutableRefObject<boolean>;
}) {
  const platform = options?.platform ?? "desktop";
  const pauseSilentSyncRef = options?.pauseSilentSyncRef;
  const { ready: authReady, membership } = useAuth();
  const allowSettings = canAccessSettings(membership?.role);
  const allowReports = canAccessReports(membership?.role);
  const syncViewDom = platform === "mobile" ? syncMobileAdminViewDom : syncLegacyAdminViewDom;
  const [activeView, setActiveView] = useState<AdminViewName>("grid");
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabName>("rooms");
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [settings, setSettings] = useState<AdminSettingsPayload>(() =>
    mergeSettings(undefined)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [appVisible, setAppVisible] = useState(false);
  const loadedTenantIdRef = useRef<string | null>(null);
  const appVisibleRef = useRef(false);
  appVisibleRef.current = appVisible;
  const initialViewBootstrapped = useRef(false);
  const activeViewRef = useRef<AdminViewName>("grid");
  activeViewRef.current = activeView;

  const guestProfilesLoadRef = useRef<Promise<void> | null>(null);

  const ensureGuestProfilesLoaded = useCallback(() => {
    if (guestProfilesLoadRef.current) return guestProfilesLoadRef.current;
    guestProfilesLoadRef.current = fetchAdminGuestProfiles()
      .then((guestProfiles) => {
        setSettings((prev) => {
          const merged =
            mergeGuestProfiles(guestProfiles, prev.guestProfiles) || guestProfiles;
          const next = { ...prev, guestProfiles: merged };
          syncLegacyGlobals({ settings: next });
          return next;
        });
      })
      .catch((err) => {
        guestProfilesLoadRef.current = null;
        if (isAdminUnauthorizedError(err)) {
          void expireAdminSession();
          return;
        }
        console.warn("guestProfiles load:", err);
      });
    return guestProfilesLoadRef.current;
  }, []);

  const applyServerData = useCallback(
    (data: AdminInitResponse, options?: { silent?: boolean }) => {
      const merged = mergeSettings(data.settings);
      const serverBookings = data.bookings || [];
      let mergedBookings: BookingRecord[] = serverBookings;

      setBookings((prev) => {
        mergedBookings = mergeBookingsWithPending(serverBookings, prev);
        window.allBookings = mergedBookings;
        return mergedBookings;
      });

      setSettings((prev) => {
        const localRoomDrafts = (prev.roomsList || []).filter((r) => isRoomDraftId(r.id));
        const localDiscountDrafts = (prev.discountsList || []).filter((d) => isDiscountDraftId(d.id));
        let nextSettings: AdminSettingsPayload = merged;
        if (localRoomDrafts.length > 0) {
          nextSettings = {
            ...nextSettings,
            roomsList: [...(merged.roomsList || []), ...localRoomDrafts],
          };
        }
        const serverDiscounts = filterPendingDeletedDiscounts(merged.discountsList || []);
        reconcilePendingDeletedDiscounts(merged.discountsList || []);
        if (localDiscountDrafts.length > 0) {
          nextSettings = {
            ...nextSettings,
            discountsList: dedupeDiscountsList([...serverDiscounts, ...localDiscountDrafts]),
          };
        } else if (serverDiscounts.length !== (merged.discountsList || []).length) {
          nextSettings = {
            ...nextSettings,
            discountsList: dedupeDiscountsList(serverDiscounts),
          };
        }
        const guestProfiles = mergeGuestProfiles(merged.guestProfiles, prev.guestProfiles);
        if (guestProfiles) {
          nextSettings = { ...nextSettings, guestProfiles };
        }
        syncLegacyGlobals({ bookings: mergedBookings, settings: nextSettings });
        return nextSettings;
      });
      if (!options?.silent) {
        refreshLegacyView(activeViewRef.current);
      }
    },
    []
  );

  const silentSync = useCallback(async () => {
    const data = await silentSyncAdminData();
    if (data) applyServerData(data, { silent: true });
  }, [applyServerData]);

  const silentSyncRef = useRef(silentSync);
  silentSyncRef.current = silentSync;

  const loadInitData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setAppVisible(false);
    try {
      const tenantId = membership?.tenantId || "";
      const prefetched = tenantId ? consumePrefetchedAdminInit(tenantId) : null;
      const data = prefetched ? await prefetched : await fetchAdminInitData();
      applyServerData(data);
      const logoUrl = normalizeDriveImageUrl(String(data.settings?.branding?.logo_url || ""));
      if (tenantId && logoUrl) {
        setCachedTenantLogoUrl(tenantId, logoUrl);
        setLastAdminTenantId(tenantId);
      }
      setAppVisible(true);
    } catch (err) {
      if (isAdminUnauthorizedError(err)) {
        console.warn("[useAdminApp] Session expired, redirecting to /login");
        setAppVisible(false);
        setLoadError(null);
        await expireAdminSession();
        return;
      }
      const msg = parseAdminFetchError(err);
      setLoadError(msg);
      showToast(msg.length > 80 ? "Помилка завантаження даних." : msg);
      console.error("adminInitData:", err);
    } finally {
      setIsLoading(false);
    }
  }, [applyServerData, membership?.tenantId]);

  useEffect(() => {
    if (!authReady) return;

    const tenantId = membership?.tenantId;
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    if (loadedTenantIdRef.current === tenantId && appVisibleRef.current) return;

    loadedTenantIdRef.current = tenantId;
    setAppVisible(false);
    void loadInitData();
  }, [authReady, membership?.tenantId, loadInitData]);

  useEffect(() => {
    if (!appVisible) return;

    if (!initialViewBootstrapped.current) {
      initialViewBootstrapped.current = true;
      const tenantId = membership?.tenantId;
      const saved = tenantId ? loadAdminNav(tenantId) : null;
      let view = saved?.activeView ?? "grid";
      if (view === "settings" && !allowSettings) view = "grid";
      if (view === "reports" && !allowReports) view = "grid";
      if (saved?.settingsTab) setSettingsTab(normalizeSettingsTab(saved.settingsTab));
      if (saved?.settingsExpanded && allowSettings) setSettingsExpanded(true);
      setActiveView(view);
      if (view === "guests") void ensureGuestProfilesLoaded();
      if (platform === "mobile") {
        syncViewDom(view, {
          settingsExpanded: view === "settings" || !!saved?.settingsExpanded,
          ...(view === "settings"
            ? { settingsTab: normalizeSettingsTab(saved?.settingsTab ?? "rooms") }
            : {}),
        });
      } else {
        syncViewDom(view, {
          settingsExpanded: view === "settings" || !!saved?.settingsExpanded,
          settingsTab: normalizeSettingsTab(saved?.settingsTab ?? settingsTab),
        });
      }
      requestAnimationFrame(() => refreshLegacyView(view));
    }

    const tg = (window as Window & { Telegram?: { WebApp?: { expand?: () => void } } })
      .Telegram?.WebApp;
    tg?.expand?.();

    const interval = window.setInterval(() => {
      if (!authReady) return;
      if (pauseSilentSyncRef?.current) return;
      const drawer = document.getElementById("bookingDrawer")?.classList.contains("active");
      const modal = document.getElementById("genericModal")?.classList.contains("active");
      const dragging = (window as Window & { isGridDragging?: boolean }).isGridDragging;
      if (!drawer && !modal && !dragging) void silentSyncRef.current();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [appVisible, authReady, membership?.tenantId, platform, settingsTab, syncViewDom, allowSettings, allowReports, ensureGuestProfilesLoaded]);

  const persistNav = useCallback(
    (view: AdminViewName, tab: SettingsTabName, expanded: boolean) => {
      const tenantId = membership?.tenantId;
      if (!tenantId) return;
      saveAdminNav(tenantId, {
        activeView: view,
        settingsTab: tab,
        settingsExpanded: expanded,
      });
    },
    [membership?.tenantId]
  );

  const switchView = useCallback(
    (viewName: AdminViewName) => {
      bosoLeave();
      let nextView = viewName;
      if (viewName === "settings" && !allowSettings) nextView = "grid";
      if (viewName === "reports" && !allowReports) nextView = "grid";
      setActiveView(nextView);
      if (nextView === "guests") void ensureGuestProfilesLoaded();
      persistNav(nextView, settingsTab, settingsExpanded);
      if (platform === "mobile" && typeof document !== "undefined") {
        const main = document.querySelector(".boso-admin-mobile .main-content");
        if (main) main.scrollTop = 0;
      }
      if (platform === "mobile") {
        syncViewDom(nextView, {
          settingsExpanded,
          ...(nextView === "settings" ? { settingsTab } : {}),
        });
      } else {
        syncViewDom(nextView, {
          settingsExpanded,
          settingsTab: nextView === "settings" ? settingsTab : undefined,
        });
      }
      requestAnimationFrame(() => refreshLegacyView(nextView));
    },
    [platform, persistNav, settingsTab, settingsExpanded, allowSettings, allowReports, syncViewDom, ensureGuestProfilesLoaded]
  );

  const switchSettingsTab = useCallback((tabName: SettingsTabName) => {
    if (!allowSettings) {
      switchView("grid");
      return;
    }
    const tab = normalizeSettingsTab(tabName);
    bosoLeave();
    setActiveView("settings");
    setSettingsExpanded(true);
    setSettingsTab(tab);
    persistNav("settings", tab, true);
    window.__adminSettingsTab = tab;
    if (platform === "mobile") {
      syncViewDom("settings", { settingsExpanded: true, settingsTab: tab });
    } else {
      syncViewDom("settings", { settingsExpanded: true, settingsTab: tab });
    }
    requestAnimationFrame(() => {
      window.__adminSettingsTab = tab;
      refreshLegacyView("settings");
    });
  }, [platform, persistNav, allowSettings, switchView, syncViewDom]);

  const toggleSettingsMenu = useCallback(() => {
    if (!allowSettings) return;
    setSettingsExpanded((prev) => {
      const next = !prev;
      const view = activeViewRef.current;
      persistNav(view, settingsTab, next);
      if (platform === "mobile") {
        syncViewDom(view, view === "settings" ? { settingsTab, settingsExpanded: next } : { settingsExpanded: next });
      } else {
        syncViewDom(view, {
          settingsExpanded: next,
          settingsTab: view === "settings" ? settingsTab : undefined,
        });
      }
      return next;
    });
  }, [persistNav, platform, settingsTab, syncViewDom, allowSettings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.switchView = (v: string) => switchView(v as AdminViewName);
    window.toggleSettingsMenu = toggleSettingsMenu;
    window.switchSettingsTab = (tab: string) =>
      switchSettingsTab(tab as SettingsTabName);
  }, [switchView, toggleSettingsMenu, switchSettingsTab]);

  useEffect(() => {
    syncLegacyGlobals({ bookings, settings });
  }, [bookings, settings]);

  useEffect(() => {
    if (!appVisible) return;
    if (platform === "mobile") {
      syncViewDom(activeView, {
        settingsExpanded,
        ...(activeView === "settings" ? { settingsTab } : {}),
      });
    } else {
      syncViewDom(activeView, { settingsExpanded, settingsTab });
    }
  }, [appVisible, activeView, platform, settingsExpanded, settingsTab]);

  const pageMeta =
    activeView === "settings"
      ? getSettingsTabPageMeta(settingsTab)
      : PAGE_TITLES[activeView];
  const showMainAction = activeView !== "reports" && activeView !== "settings";

  return {
    activeView,
    settingsExpanded,
    settingsTab,
    bookings,
    settings,
    setBookings,
    setSettings,
    isLoading,
    loadError,
    appVisible,
    pageMeta,
    showMainAction,
    switchView,
    toggleSettingsMenu,
    switchSettingsTab,
    reload: loadInitData,
    silentSync,
    applyServerData,
    ensureGuestProfilesLoaded,
  };
}
