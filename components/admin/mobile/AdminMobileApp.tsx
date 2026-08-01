"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isAndroidUserAgent, isIOSUserAgent } from "@/lib/isMobileUserAgent";
import { AdminGridDashboard } from "@/components/admin/dashboard/AdminGridDashboard";
import { useAdminUndo, resolveActiveUndoScope } from "@/components/admin/undo/useAdminUndo";
import { useAuth } from "@/components/auth/AuthProvider";
import { canAccessReports, canAccessSettings } from "@/lib/admin/permissions";
import { expireAdminSession } from "@/lib/admin/adminSession";
import { isRoomDraftId } from "@/lib/admin/roomDraft";
import { isDiscountDraftId } from "@/lib/admin/discountDraft";
import { DesktopBookingDrawer } from "../desktop/DesktopBookingDrawer";
import { DesktopModals } from "../desktop/DesktopModals";
import { DesktopOverlays } from "../desktop/DesktopOverlays";
import { GridFocusModeProvider } from "../desktop/GridFocusModeContext";
import { registerAdminDesktopHandlers } from "../desktop/registerAdminDesktopHandlers";
import { DesktopBookingsListView } from "../desktop/views/DesktopBookingsListView";
import { DesktopGuestsView } from "../desktop/views/DesktopGuestsView";
import { DesktopReportsView } from "../desktop/views/DesktopReportsView";
import { DesktopSettingsView } from "../desktop/views/DesktopSettingsView";
import { AdminLoadErrorScreen } from "@/components/admin/AdminLoadErrorScreen";
import { AdminDocumentTitleSync } from "@/components/admin/AdminDocumentTitleSync";
import { useAdminBootFromAdmin } from "@/components/admin/useAdminBootFromAdmin";
import { normalizeDriveImageUrl } from "@/lib/driveImageUrl";
import { useAdminApp } from "../desktop/useAdminApp";
import { useAdminModals } from "../desktop/useAdminModals";
import { useAdminUiBridge } from "../desktop/useAdminUiBridge";
import { useBookingDrawer } from "../desktop/useBookingDrawer";
import { AdminViewPane } from "./AdminViewPane";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileTopBar } from "./MobileTopBar";
import { MobileUiProvider } from "./MobileUiContext";

export function AdminMobileApp() {
  const { signOut, membership } = useAuth();
  const publicBookUrl = membership?.tenantId
    ? `/book/${membership.tenantId}`
    : undefined;
  const pauseSilentSyncRef = useRef(false);
  const admin = useAdminApp({ platform: "mobile", pauseSilentSyncRef });
  useAdminBootFromAdmin(admin, membership?.tenantId);
  const adminUndo = useAdminUndo({
    bookings: admin.bookings,
    roomsList: admin.settings.roomsList,
    setBookings: admin.setBookings,
    setSettings: admin.setSettings,
    onAfterBookingChange: admin.silentSync,
    onSessionExpired: expireAdminSession,
    activeUndoScope: resolveActiveUndoScope(admin.activeView, admin.settingsTab),
  });
  const bridge = useAdminUiBridge({
    activeView: admin.activeView,
    bookings: admin.bookings,
    setBookings: admin.setBookings,
    applyServerData: admin.applyServerData,
    silentSync: admin.silentSync,
    switchView: admin.switchView,
    signOut,
    adminUndo,
  });

  const drawer = useBookingDrawer({
    bookings: admin.bookings,
    settings: admin.settings,
    editingRowRef: bridge.editingRowRef,
    earlyTimeRef: bridge.earlyTimeRef,
    lateTimeRef: bridge.lateTimeRef,
    setBookings: admin.setBookings,
  });

  useEffect(() => {
    if (drawer.drawerOpen) void admin.ensureGuestProfilesLoaded();
  }, [drawer.drawerOpen, admin.ensureGuestProfilesLoaded]);

  const priceTimelineBaseDateRef = useRef(new Date());
  const restrictionsTimelineBaseDateRef = useRef(new Date());
  priceTimelineBaseDateRef.current.setDate(1);
  restrictionsTimelineBaseDateRef.current.setDate(1);

  const modals = useAdminModals({
    settings: admin.settings,
    setSettings: admin.setSettings,
    bookings: admin.bookings,
    settingsTab: admin.settingsTab,
    priceTimelineBaseDateRef,
    restrictionsTimelineBaseDateRef,
    adminUndo,
  });

  useEffect(() => {
    const hasDraftRoom = (admin.settings.roomsList || []).some((r) => isRoomDraftId(r.id));
    const hasDraftDiscount = (admin.settings.discountsList || []).some((d) => isDiscountDraftId(d.id));
    pauseSilentSyncRef.current =
      modals.roomAccordionKey != null ||
      modals.roomDrawerOpen ||
      modals.genericOpen ||
      modals.discountAccordionKey != null ||
      hasDraftRoom ||
      hasDraftDiscount;
  }, [
    modals.roomAccordionKey,
    modals.roomDrawerOpen,
    modals.genericOpen,
    modals.discountAccordionKey,
    admin.settings.roomsList,
    admin.settings.discountsList,
  ]);

  useEffect(() => registerAdminDesktopHandlers(modals), [modals]);

  const [guestFilter, setGuestFilter] = useState<{ name: string; phone: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.resetGuestFilter = () => setGuestFilter(null);
    return () => {
      delete window.resetGuestFilter;
    };
  }, []);

  if (admin.loadError && !admin.appVisible && !admin.isLoading) {
    return (
      <AdminLoadErrorScreen
        error={admin.loadError}
        onRetry={() => void admin.reload()}
      />
    );
  }

  const branding = (admin.settings.branding || {}) as Record<string, unknown>;
  const documentSiteTitle =
    String(branding.site_title || "").trim() || membership?.tenantName || null;
  const brandLogoUrl = normalizeDriveImageUrl(String(branding.logo_url || "")) || null;

  const platformClass = useMemo(() => {
    if (typeof navigator === "undefined") return "";
    if (isAndroidUserAgent(navigator.userAgent)) return "boso-admin-android";
    if (isIOSUserAgent(navigator.userAgent)) return "boso-admin-ios";
    return "";
  }, []);

  useEffect(() => {
    if (!platformClass) return;
    document.body.classList.add(platformClass);
    return () => document.body.classList.remove(platformClass);
  }, [platformClass]);

  return (
    <MobileUiProvider>
      <GridFocusModeProvider tenantId={membership?.tenantId}>
      <AdminDocumentTitleSync siteTitle={documentSiteTitle} enabled={admin.appVisible} />
      <div className={`boso-admin-mobile${platformClass ? ` ${platformClass}` : ""}`}>
        <div id="admin-app" className={admin.appVisible ? "is-visible" : undefined}>
          <MobileTopBar
            title={admin.pageMeta.title}
            showMainAction={admin.showMainAction}
            onCreateBooking={() => drawer.openNewBookingDrawer()}
            publicBookUrl={publicBookUrl}
            logoUrl={brandLogoUrl}
            logoAlt={documentSiteTitle}
          />

          <div className="main-content">
            {admin.loadError ? (
              <div
                className="admin-load-error-banner"
                style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: "#FFF" }}
              >
                {admin.loadError}{" "}
                <button
                  type="button"
                  className="btn-secondary tap-btn"
                  style={{ marginTop: 8 }}
                  onClick={() => void admin.reload()}
                >
                  Повторити
                </button>
              </div>
            ) : null}

            <AdminViewPane view="list" active={admin.activeView}>
              <DesktopBookingsListView
                layout="mobile"
                bookings={admin.bookings}
                roomsList={admin.settings.roomsList}
                onOpenBooking={drawer.openDetailsByRow}
                guestFilter={guestFilter}
                onClearGuestFilter={() => setGuestFilter(null)}
              />
            </AdminViewPane>
            {admin.activeView === "grid" ? (
              <AdminGridDashboard
                layout="mobile"
                roomsList={admin.settings.roomsList}
                bookings={admin.bookings}
                settings={admin.settings}
                onOpenBooking={drawer.openDetailsByRow}
                onCreateBooking={(room, checkIn, checkOut) =>
                  drawer.openNewBookingDrawer(room, checkIn, checkOut)
                }
                adminUndo={adminUndo}
              />
            ) : null}
            <AdminViewPane view="guests" active={admin.activeView}>
              <DesktopGuestsView
                layout="mobile"
                bookings={admin.bookings}
                guestProfiles={admin.settings.guestProfiles}
                onUpsertGuestProfile={modals.upsertGuestProfile}
                onShowGuestBookings={(phone, name) => {
                  setGuestFilter({ phone, name });
                  admin.switchView("list");
                }}
              />
            </AdminViewPane>
            <AdminViewPane view="reports" active={admin.activeView}>
              <DesktopReportsView
                layout="mobile"
                bookings={admin.bookings}
                transactions={admin.settings.transactions || []}
                roomsList={admin.settings.roomsList}
                customPrices={admin.settings.customPrices}
                settings={admin.settings}
                onSettingsChange={admin.setSettings}
                onOpenBooking={drawer.openDetailsByRow}
                isActive
              />
            </AdminViewPane>
            {admin.activeView === "settings" ? (
              <DesktopSettingsView
                layout="mobile"
                settings={admin.settings}
                tenantName={membership?.tenantName}
                onSettingsChange={admin.setSettings}
                activeTab={admin.settingsTab}
                onSettingsTab={admin.switchSettingsTab}
                onLogout={() => void signOut()}
                modals={modals}
                priceTimelineBaseDateRef={priceTimelineBaseDateRef}
                restrictionsTimelineBaseDateRef={restrictionsTimelineBaseDateRef}
                adminUndo={adminUndo}
                bookings={admin.bookings}
                onShowGuestBookings={(phone, name) => {
                  setGuestFilter({ phone, name });
                  admin.switchView("list");
                }}
              />
            ) : null}
          </div>

          <MobileBottomNav
            activeView={admin.activeView}
            onNavigate={admin.switchView}
            canAccessSettings={canAccessSettings(membership?.role)}
            canAccessReports={canAccessReports(membership?.role)}
          />
        </div>

        {/* Outside #admin-app flex so overlays never steal shell height / hide bottom nav */}
        <div className="admin-mobile-portals">
          <DesktopBookingDrawer
            roomsList={admin.settings.roomsList}
            drawer={drawer}
            settings={admin.settings}
            bookings={admin.bookings}
            onBookingReviewed={() => admin.silentSync()}
            onUpsertGuestProfile={modals.upsertGuestProfile}
          />
          <DesktopModals modals={modals} settings={admin.settings} />
          <DesktopOverlays />
        </div>
      </div>
      </GridFocusModeProvider>
    </MobileUiProvider>
  );
}
