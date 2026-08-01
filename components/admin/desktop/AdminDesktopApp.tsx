"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AdminGridDashboard } from "@/components/admin/dashboard/AdminGridDashboard";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  canAccessReports,
  canAccessSettings,
} from "@/lib/admin/permissions";
import { expireAdminSession } from "@/lib/admin/adminSession";
import { normalizeDriveImageUrl } from "@/lib/driveImageUrl";
import { isRoomDraftId } from "@/lib/admin/roomDraft";
import { isDiscountDraftId } from "@/lib/admin/discountDraft";
import { DesktopBookingDrawer } from "./DesktopBookingDrawer";
import { DesktopHeader } from "./DesktopHeader";
import { DesktopModals } from "./DesktopModals";
import { DesktopOverlays } from "./DesktopOverlays";
import { GridFocusModeProvider, useGridFocusModeOptional } from "./GridFocusModeContext";
import { DesktopSidebar } from "./DesktopSidebar";
import { registerAdminDesktopHandlers } from "./registerAdminDesktopHandlers";
import { DesktopBookingsListView } from "./views/DesktopBookingsListView";
import { DesktopGuestsView } from "./views/DesktopGuestsView";
import { DesktopReportsView } from "./views/DesktopReportsView";
import { DesktopSettingsView } from "./views/DesktopSettingsView";
import { AdminLoadErrorScreen } from "@/components/admin/AdminLoadErrorScreen";
import { AdminDocumentTitleSync } from "@/components/admin/AdminDocumentTitleSync";
import { useAdminBootFromAdmin } from "@/components/admin/useAdminBootFromAdmin";
import { useAdminApp } from "./useAdminApp";
import { useAdminModals } from "./useAdminModals";
import { useAdminUiBridge } from "./useAdminUiBridge";
import { useAdminUndo, resolveActiveUndoScope } from "@/components/admin/undo/useAdminUndo";
import { useBookingDrawer } from "./useBookingDrawer";
import { getAdminViewStyle } from "./adminViewDom";
import { getSettingsTabPageMeta } from "./settingsTabMeta";
import { DiscountTemplatesToggleButton } from "./settings/DiscountTemplatesToggleButton";
import { RedirectPhoneToMobileAdmin } from "@/components/admin/RedirectPhoneToMobileAdmin";
import "./settings/settings-side-drawer.css";
import "./settings/settings-discounts.css";
import "./settings/settings-additional-services.css";

function AdminMainContent({
  activeView,
  children,
}: {
  activeView: string;
  children: ReactNode;
}) {
  const { isCompactMode } = useGridFocusModeOptional();
  const className = [
    "main-content",
    activeView === "settings" ? "main-content--settings" : "",
    activeView === "grid" && isCompactMode ? "main-content--grid-focus" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={className}>{children}</div>;
}

export function AdminDesktopApp() {
  const { signOut, membership, user } = useAuth();
  const publicBookUrl = membership?.tenantId
    ? `/book/${membership.tenantId}`
    : undefined;
  const actorLabel =
    membership?.displayName || user?.name || membership?.email || user?.email || null;
  const allowSettings = canAccessSettings(membership?.role);
  const allowReports = canAccessReports(membership?.role);
  const pauseSilentSyncRef = useRef(false);
  const admin = useAdminApp({ pauseSilentSyncRef });
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
  const [sidebarLogoPreviewUrl, setSidebarLogoPreviewUrl] = useState<string | null>(null);
  const branding = (admin.settings.branding || {}) as Record<string, unknown>;
  const sidebarBrandName =
    String(branding.site_title || "").trim() || membership?.tenantName || null;

  useEffect(() => {
    const raw = normalizeDriveImageUrl(String(branding.logo_url || ""));
    if (raw) setSidebarLogoPreviewUrl(raw);
  }, [branding.logo_url]);

  const settingsTabMeta =
    admin.activeView === "settings" ? getSettingsTabPageMeta(admin.settingsTab) : null;
  const hasDiscounts = (admin.settings.discountsList || []).length > 0;
  const settingsHeaderAction =
    admin.activeView === "settings" && admin.settingsTab === "rooms" ? (
      <button
        type="button"
        className="btn-primary"
        style={{ padding: "10px 16px", fontSize: 13 }}
        onClick={() => modals.addRoomDraft()}
      >
        + Додати житло
      </button>
    ) : admin.activeView === "settings" && admin.settingsTab === "discounts" && hasDiscounts ? (
      <DiscountTemplatesToggleButton modals={modals} />
    ) : undefined;

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

  return (
    <GridFocusModeProvider tenantId={membership?.tenantId}>
      <RedirectPhoneToMobileAdmin />
      <AdminDocumentTitleSync siteTitle={sidebarBrandName} enabled={admin.appVisible} />
      <div id="admin-app" className={admin.appVisible ? "is-visible" : undefined}>
        <DesktopSidebar
          activeView={admin.activeView}
          settingsExpanded={admin.settingsExpanded}
          settingsTab={admin.settingsTab}
          tenantId={membership?.tenantId}
          tenantName={sidebarBrandName}
          tenantPlan={membership?.plan}
          publicBookUrl={publicBookUrl}
          logoPreviewUrl={sidebarLogoPreviewUrl}
          canAccessSettings={allowSettings}
          canAccessReports={allowReports}
          actorLabel={actorLabel}
          onNavigate={admin.switchView}
          onToggleSettings={admin.toggleSettingsMenu}
          onSettingsTab={admin.switchSettingsTab}
        />
        <AdminMainContent activeView={admin.activeView}>
          <DesktopHeader
            key={`${admin.activeView}-${admin.settingsTab}`}
            pageTitle={admin.pageMeta.title}
            pageIconPath={admin.pageMeta.icon}
            iconVariant={settingsTabMeta?.iconVariant}
            titleAccent={admin.activeView === "settings"}
            showMainAction={admin.showMainAction}
            headerAction={settingsHeaderAction}
            onCreateBooking={() => drawer.openNewBookingDrawer()}
          />
          {admin.isLoading && admin.appVisible ? (
            <div className="admin-sync-banner" role="status">
              Оновлюємо дані з таблиці…
            </div>
          ) : null}
          {admin.loadError ? (
            <div className="admin-load-error-banner card">
              {admin.loadError}{" "}
              <button
                type="button"
                className="btn-secondary"
                style={{ marginLeft: 12 }}
                onClick={() => void admin.reload()}
              >
                Повторити
              </button>
            </div>
          ) : null}
          <DesktopBookingsListView
            style={getAdminViewStyle("list", admin.activeView)}
            bookings={admin.bookings}
            roomsList={admin.settings.roomsList}
            onOpenBooking={drawer.openDetailsByRow}
            guestFilter={guestFilter}
            onClearGuestFilter={() => setGuestFilter(null)}
          />
          <AdminGridDashboard
            style={getAdminViewStyle("grid", admin.activeView)}
            roomsList={admin.settings.roomsList}
            bookings={admin.bookings}
            settings={admin.settings}
            onOpenBooking={drawer.openDetailsByRow}
            onCreateBooking={(room, checkIn, checkOut) =>
              drawer.openNewBookingDrawer(room, checkIn, checkOut)
            }
            onNewBooking={() => drawer.openNewBookingDrawer()}
            adminUndo={adminUndo}
          />
          <DesktopGuestsView
            style={getAdminViewStyle("guests", admin.activeView)}
            bookings={admin.bookings}
            guestProfiles={admin.settings.guestProfiles}
            onUpsertGuestProfile={modals.upsertGuestProfile}
            onShowGuestBookings={(phone, name) => {
              setGuestFilter({ phone, name });
              admin.switchView("list");
            }}
          />
          <DesktopReportsView
            style={getAdminViewStyle("reports", admin.activeView)}
            bookings={admin.bookings}
            transactions={admin.settings.transactions || []}
            roomsList={admin.settings.roomsList}
            customPrices={admin.settings.customPrices}
            settings={admin.settings}
            onSettingsChange={admin.setSettings}
            onOpenBooking={drawer.openDetailsByRow}
            isActive={admin.activeView === "reports"}
          />
          <DesktopSettingsView
            style={getAdminViewStyle("settings", admin.activeView)}
            settings={admin.settings}
            tenantName={membership?.tenantName}
            onLogoPreviewChange={setSidebarLogoPreviewUrl}
            onSettingsChange={admin.setSettings}
            activeTab={admin.settingsTab}
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
        </AdminMainContent>
      </div>
    </GridFocusModeProvider>
  );
}
