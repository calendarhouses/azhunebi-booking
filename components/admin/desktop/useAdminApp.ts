"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  expireAdminSession,
  isAdminUnauthorizedError,
} from "@/lib/admin/adminSession";
import { loadAdminNav, saveAdminNav } from "@/lib/admin/adminNavPersistence";
import { parseAdminFetchError } from "@/lib/admin/parseAdminApiError";
import { useAuth } from "@/components/auth/AuthProvider";
import { isRoomDraftId } from "@/lib/admin/roomDraft";
import { isDiscountDraftId, dedupeDiscountsList } from "@/lib/admin/discountDraft";
import {
  filterPendingDeletedDiscounts,
  reconcilePendingDeletedDiscounts,
} from "@/lib/admin/discountPendingDeletes";
import { fetchAdminInitData, silentSyncAdminData } from "./adminApi";
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

/** Лише дані з API — без dummy fallback. */
function mergeSettings(raw: AdminSettingsPayload | undefined): AdminSettingsPayload {
  const s = raw || {};
  return {
    roomsList: Array.isArray(s.roomsList) ? s.roomsList : [],
    discountsList: Array.isArray(s.discountsList) ? s.discountsList : [],
    customServicesList: Array.isArray(s.customServicesList) ? s.customServicesList : [],
    sysServicesList: Array.isArray(s.sysServicesList) ? s.sysServicesList : [],
    customPrices: s.customPrices && typeof s.customPrices === "object" ? s.customPrices : {},
    restrictions: s.restrictions && typeof s.restrictions === "object" ? s.restrictions : {},
    transactions: Array.isArray(s.transactions) ? s.transactions : [],
    branding: s.branding,
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
  const initialViewBootstrapped = useRef(false);
  const activeViewRef = useRef<AdminViewName>("grid");
  activeViewRef.current = activeView;

  const applyServerData = useCallback(
    (data: AdminInitResponse, options?: { silent?: boolean }) => {
      const merged = mergeSettings(data.settings);
      const nextBookings = data.bookings || [];
      setBookings(nextBookings);
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
        syncLegacyGlobals({ bookings: nextBookings, settings: nextSettings });
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
    try {
      const data = await fetchAdminInitData();
      applyServerData(data);
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
  }, [applyServerData]);

  useEffect(() => {
    const tenantId = membership?.tenantId;
    if (!authReady || !tenantId) return;
    if (loadedTenantIdRef.current === tenantId) return;
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
      const view = saved?.activeView ?? "grid";
      if (saved?.settingsTab) setSettingsTab(saved.settingsTab);
      if (saved?.settingsExpanded) setSettingsExpanded(true);
      setActiveView(view);
      if (platform === "mobile") {
        syncViewDom(view, {
          settingsExpanded: view === "settings" || !!saved?.settingsExpanded,
          ...(view === "settings" ? { settingsTab: saved?.settingsTab ?? "rooms" } : {}),
        });
      } else {
        syncViewDom(view, {
          settingsExpanded: view === "settings" || !!saved?.settingsExpanded,
          settingsTab: saved?.settingsTab ?? settingsTab,
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
  }, [appVisible, authReady, membership?.tenantId, platform, settingsTab, syncViewDom]);

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
      setActiveView(viewName);
      persistNav(viewName, settingsTab, settingsExpanded);
      if (platform === "mobile" && typeof document !== "undefined") {
        const main = document.querySelector(".boso-admin-mobile .main-content");
        if (main) main.scrollTop = 0;
      }
      if (platform === "mobile") {
        syncViewDom(viewName, {
          settingsExpanded,
          ...(viewName === "settings" ? { settingsTab } : {}),
        });
      } else {
        syncViewDom(viewName, {
          settingsExpanded,
          settingsTab: viewName === "settings" ? settingsTab : undefined,
        });
      }
      requestAnimationFrame(() => refreshLegacyView(viewName));
    },
    [platform, persistNav, settingsTab, settingsExpanded]
  );

  const switchSettingsTab = useCallback((tabName: SettingsTabName) => {
    bosoLeave();
    setActiveView("settings");
    setSettingsExpanded(true);
    setSettingsTab(tabName);
    persistNav("settings", tabName, true);
    window.__adminSettingsTab = tabName;
    if (platform === "mobile") {
      syncViewDom("settings", { settingsExpanded: true, settingsTab: tabName });
    } else {
      syncViewDom("settings", { settingsExpanded: true, settingsTab: tabName });
    }
    requestAnimationFrame(() => {
      window.__adminSettingsTab = tabName;
      refreshLegacyView("settings");
    });
  }, [platform, persistNav]);

  const toggleSettingsMenu = useCallback(() => {
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
  }, [persistNav, platform, settingsTab, syncViewDom]);

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
  };
}
