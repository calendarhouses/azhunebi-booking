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
  releasePrefetchedAdminInit,
} from "@/lib/admin/adminInitPrefetch";
import {
  fetchGuestProfilesRemote,
  guestPhoneKey,
  saveGuestProfileRemote,
  type GuestProfile,
  type GuestProfilesMap,
  type GuestRating,
} from "@/lib/admin/guestProfiles";
import { normalizeDriveImageUrl } from "@/lib/driveImageUrl";
import { useAuth } from "@/components/auth/AuthProvider";
import { canAccessReports, canAccessSettings } from "@/lib/admin/permissions";
import { isRoomDraftId } from "@/lib/admin/roomDraft";
import { isDiscountDraftId, dedupeDiscountsList } from "@/lib/admin/discountDraft";
import {
  filterPendingDeletedDiscounts,
  reconcilePendingDeletedDiscounts,
} from "@/lib/admin/discountPendingDeletes";
import {
  fetchAdminChessboardData,
  fetchAdminDeferredData,
  getAdminTenantId,
  setAdminTenantId,
  silentSyncAdminData,
} from "./adminApi";
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
    telegramTurnoversState: s.telegramTurnoversState,
    telegramBookingsState: s.telegramBookingsState,
  };
}

/**
 * Chessboard / silent sync stubs empty price grids — keep deferred-loaded maps.
 */
function mergeSettingsPreservingHeavy(
  raw: AdminSettingsPayload | undefined,
  prev: AdminSettingsPayload
): AdminSettingsPayload {
  const incoming = mergeSettings(raw);
  const keepMap = <T extends Record<string, unknown>>(next: T, prior: T | undefined): T => {
    if (prior && Object.keys(prior).length > 0 && Object.keys(next).length === 0) {
      return prior;
    }
    return next;
  };
  const keepList = <T>(next: T[], prior: T[] | undefined): T[] => {
    if (prior && prior.length > 0 && next.length === 0) return prior;
    return next;
  };
  return {
    ...incoming,
    roomsList:
      (incoming.roomsList || []).length > 0 ? incoming.roomsList : prev.roomsList || [],
    discountsList: keepList(incoming.discountsList || [], prev.discountsList),
    customServicesList: keepList(incoming.customServicesList || [], prev.customServicesList),
    sysServicesList: keepList(incoming.sysServicesList || [], prev.sysServicesList),
    customPrices: keepMap(incoming.customPrices || {}, prev.customPrices),
    restrictions: keepMap(incoming.restrictions || {}, prev.restrictions),
    closedDates: keepMap(incoming.closedDates || {}, prev.closedDates),
    flexibleScheduleSettings:
      incoming.flexibleScheduleSettings ?? prev.flexibleScheduleSettings,
    smsSettings: incoming.smsSettings ?? prev.smsSettings,
    telegramTurnoversState:
      incoming.telegramTurnoversState ?? prev.telegramTurnoversState,
    telegramBookingsState:
      incoming.telegramBookingsState ?? prev.telegramBookingsState,
    branding: incoming.branding ?? prev.branding,
    transactions:
      (incoming.transactions || []).length > 0
        ? incoming.transactions
        : prev.transactions || [],
  };
}

/** Slim chessboard rows overwrite grid fields; keep deferred extras on same id. */
function mergeSlimBookingsOntoLocal(
  serverBookings: BookingRecord[],
  localBookings: BookingRecord[]
): BookingRecord[] {
  const localById = new Map(localBookings.map((b) => [String(b.id), b]));
  const enriched = serverBookings.map((server) => {
    const prev = localById.get(String(server.id));
    if (!prev) return server;
    return { ...prev, ...server };
  });
  return mergeBookingsWithPending(enriched, localBookings);
}

function isSlimBootPhase(phase: AdminInitResponse["bootPhase"] | undefined): boolean {
  return phase === "chessboard";
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
  const [guestProfiles, setGuestProfiles] = useState<GuestProfilesMap>({});
  const guestProfilesLoadedRef = useRef(false);
  const loadedTenantIdRef = useRef<string | null>(null);
  const appVisibleRef = useRef(false);
  const loadInFlightRef = useRef(false);
  appVisibleRef.current = appVisible;
  const initialViewBootstrapped = useRef(false);
  const activeViewRef = useRef<AdminViewName>("grid");
  activeViewRef.current = activeView;

  const applyServerData = useCallback(
    (data: AdminInitResponse, options?: { silent?: boolean }) => {
      const slim = isSlimBootPhase(data.bootPhase);
      const serverBookings = data.bookings || [];
      let mergedBookings: BookingRecord[] = serverBookings;

      setBookings((prev) => {
        mergedBookings = slim
          ? mergeSlimBookingsOntoLocal(serverBookings, prev)
          : mergeBookingsWithPending(serverBookings, prev);
        window.allBookings = mergedBookings;
        return mergedBookings;
      });

      setSettings((prev) => {
        const merged = slim
          ? mergeSettingsPreservingHeavy(data.settings, prev)
          : mergeSettings(data.settings);
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

  const deferredLoadedRef = useRef(false);

  const loadInitData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    deferredLoadedRef.current = false;
    try {
      const tenantId = membership?.tenantId || getAdminTenantId() || "";
      if (tenantId) setAdminTenantId(tenantId);
      const prefetched = tenantId ? consumePrefetchedAdminInit(tenantId) : null;
      const data = prefetched
        ? await prefetched
        : await fetchAdminChessboardData(tenantId || undefined);
      applyServerData(data);
      if (tenantId) releasePrefetchedAdminInit(tenantId);
      const logoUrl = normalizeDriveImageUrl(String(data.settings?.branding?.logo_url || ""));
      if (tenantId && logoUrl) {
        setCachedTenantLogoUrl(tenantId, logoUrl);
        setLastAdminTenantId(tenantId);
      }
      // Paint immediately after chessboard — do not wait for deferred.
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
      console.error("adminChessboard:", err);
    } finally {
      setIsLoading(false);
    }
  }, [applyServerData, membership?.tenantId]);

  const loadDeferredData = useCallback(async () => {
    if (deferredLoadedRef.current) return;
    deferredLoadedRef.current = true;
    try {
      const data = await fetchAdminDeferredData();
      if (data) applyServerData(data, { silent: true });
    } catch (err) {
      deferredLoadedRef.current = false;
      if (isAdminUnauthorizedError(err)) {
        console.warn("[useAdminApp] Session expired during deferred load");
        await expireAdminSession();
        return;
      }
      console.warn("[useAdminApp] adminDeferred failed:", err);
    }
  }, [applyServerData]);
  useEffect(() => {
    if (!authReady) return;

    const tenantId = membership?.tenantId;
    if (!tenantId) {
      setIsLoading(false);
      setLoadError("Не вдалося визначити комплекс.");
      return;
    }

    // Already painted for this tenant — don't restart and hide the UI again.
    if (loadedTenantIdRef.current === tenantId && appVisibleRef.current) return;
    // Same tenant already loading (Strict Mode / callback identity churn).
    if (loadedTenantIdRef.current === tenantId && loadInFlightRef.current) return;

    loadedTenantIdRef.current = tenantId;
    loadInFlightRef.current = true;
    deferredLoadedRef.current = false;
    setAppVisible(false);
    void loadInitData().finally(() => {
      loadInFlightRef.current = false;
    });
  }, [authReady, membership?.tenantId, loadInitData]);

  // Guest CRM ratings — lazy, standalone GAS action, fetched once per session
  // only AFTER the app has painted. Never part of adminInitData/adminBoot;
  // see lib/admin/guestProfiles.ts.
  useEffect(() => {
    if (!appVisible || guestProfilesLoadedRef.current) return;
    guestProfilesLoadedRef.current = true;
    void fetchGuestProfilesRemote()
      .then((profiles) => setGuestProfiles(profiles))
      .catch((err) => {
        guestProfilesLoadedRef.current = false;
        console.warn("[useAdminApp] guestProfiles load failed:", err);
      });
  }, [appVisible]);

  // Stage-A: enrich prices / restrictions / list bookings after chessboard paint.
  useEffect(() => {
    if (!appVisible) return;
    void loadDeferredData();
  }, [appVisible, loadDeferredData]);
  const upsertGuestProfile = useCallback(
    (rawPhone: string, patch: { rating?: GuestRating | null; note?: string | null }) => {
      const phone = guestPhoneKey(rawPhone);
      if (!phone) return;
      let mergedProfile: GuestProfile = {};
      setGuestProfiles((prev) => {
        const nextProfile: GuestProfile = { ...(prev[phone] || {}) };
        if ("rating" in patch) {
          if (patch.rating) nextProfile.rating = patch.rating;
          else delete nextProfile.rating;
        }
        if ("note" in patch) {
          const note = String(patch.note || "").trim();
          if (note) nextProfile.note = note;
          else delete nextProfile.note;
        }
        mergedProfile = nextProfile;
        if (!nextProfile.rating && !nextProfile.note) {
          if (!(phone in prev)) return prev;
          const next = { ...prev };
          delete next[phone];
          return next;
        }
        return { ...prev, [phone]: nextProfile };
      });
      void saveGuestProfileRemote(phone, {
        rating: mergedProfile.rating ?? null,
        note: mergedProfile.note ?? null,
      }).catch((err) => {
        console.error("[useAdminApp] saveGuestProfile failed:", err);
        showToast("Не вдалося зберегти оцінку гостя.");
      });
    },
    []
  );

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
    }, 60000);

    return () => window.clearInterval(interval);
  }, [appVisible, authReady, membership?.tenantId, platform, settingsTab, syncViewDom, allowSettings, allowReports]);

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
    [platform, persistNav, settingsTab, settingsExpanded, allowSettings, allowReports, syncViewDom]
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
    guestProfiles,
    upsertGuestProfile,
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
