"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { DesktopPriceGrid } from "../settings/DesktopPriceGrid";
import {
  DesktopRestrictionsGrid,
  scrollToRestrictionsGrid,
} from "../settings/DesktopRestrictionsGrid";
import { BrandingSettingsPanel } from "../settings/BrandingSettingsPanel";
import { DiscountTemplateGallery } from "../settings/DiscountTemplateGallery";
import { AdditionalServicesSettingsPage } from "../settings/AdditionalServicesSettingsPage";
import { SettingsRoomsTable } from "../settings/DesktopSettingsTables";
import { SIDEBAR_SETTINGS_ITEMS } from "../sidebarSettingsItems";
import type { AdminModalsApi } from "../useAdminModals";
import type { AdminUndoApi } from "@/components/admin/undo/useAdminUndo";
import { SETTINGS_FIT_CONTENT_TABS, SETTINGS_FULL_WIDTH_TABS } from "../settingsTabMeta";
import type { AdminSettingsPayload, SettingsTabName } from "../types";

function tabDisplay(active: SettingsTabName, tab: SettingsTabName): CSSProperties {
  return { display: active === tab ? "block" : "none" };
}

function tabContentClass(active: SettingsTabName, tab: SettingsTabName, extra?: string) {
  return [
    "settings-tab-content",
    extra,
    active === tab ? "settings-tab-content--active" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

const MOBILE_SETTINGS_TABS = SIDEBAR_SETTINGS_ITEMS.map(({ tab, label }) => ({ tab, label }));

export interface DesktopSettingsViewProps {
  style?: CSSProperties;
  layout?: "desktop" | "mobile";
  settings: AdminSettingsPayload;
  tenantName?: string | null;
  onLogoPreviewChange?: (nextUrl: string | null) => void;
  onSettingsChange?: (next: AdminSettingsPayload) => void;
  activeTab?: SettingsTabName;
  onSettingsTab?: (tab: SettingsTabName) => void;
  modals: AdminModalsApi;
  priceTimelineBaseDateRef: React.MutableRefObject<Date>;
  restrictionsTimelineBaseDateRef: React.MutableRefObject<Date>;
  adminUndo: AdminUndoApi;
}

export function DesktopSettingsView({
  style,
  layout = "desktop",
  settings,
  tenantName,
  onLogoPreviewChange,
  onSettingsChange,
  activeTab = "rooms",
  onSettingsTab,
  modals,
  priceTimelineBaseDateRef,
  restrictionsTimelineBaseDateRef,
  adminUndo,
}: DesktopSettingsViewProps) {
  const isMobile = layout === "mobile";
  const restrictionsWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollToRestrictionsGrid = () => scrollToRestrictionsGrid(restrictionsWrapperRef);
    }
    return () => {
      delete (window as Window & { scrollToRestrictionsGrid?: () => void }).scrollToRestrictionsGrid;
    };
  }, []);

  useEffect(() => {
    if (activeTab === "restrictions") {
      scrollToRestrictionsGrid(restrictionsWrapperRef);
    }
    if (activeTab === "prices" && typeof window !== "undefined") {
      window.renderPriceGrid?.();
    }
    if (activeTab === "restrictions" && typeof window !== "undefined") {
      window.renderRestrictionsGrid?.();
    }
  }, [activeTab]);

  const tableProps = { settings, modals, layout };
  const showTab = (tab: SettingsTabName) => !isMobile || activeTab === tab;

  const settingsContentClass = isMobile
    ? undefined
    : [
        "settings-content",
        SETTINGS_FIT_CONTENT_TABS.includes(activeTab) ? "settings-content--compact" : "",
        SETTINGS_FULL_WIDTH_TABS.includes(activeTab) ? "settings-content--full-width" : "",
        activeTab === "prices" || activeTab === "restrictions" ? "settings-content--prices-tab" : "",
      ]
        .filter(Boolean)
        .join(" ");

  return (
    <div id="view-settings" className="admin-settings-view" style={style}>
      {isMobile ? (
        <>
          <button
            type="button"
            className="btn-secondary mobile-logout-btn tap-btn"
            onClick={() => {
              (window as Window & { BosoAuth?: { logout?: () => void } }).BosoAuth?.logout?.();
            }}
          >
            Вийти з акаунту
          </button>
          <div className="mobile-settings-tabs" role="tablist" aria-label="Налаштування">
            {MOBILE_SETTINGS_TABS.map(({ tab, label }) => (
              <button
                key={tab}
                type="button"
                className={`m-tab tap-btn${activeTab === tab ? " active" : ""}`}
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => onSettingsTab?.(tab)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className={settingsContentClass}>
        {showTab("branding") ? (
        <div
          id="set-branding"
          className={tabContentClass(activeTab, "branding")}
          style={isMobile ? undefined : tabDisplay(activeTab, "branding")}
        >
          <BrandingSettingsPanel
            settings={settings}
            onLogoPreviewChange={onLogoPreviewChange}
            onSettingsChange={onSettingsChange ?? (() => {})}
            isActive={!isMobile && activeTab === "branding"}
          />
        </div>
        ) : null}

        {showTab("rooms") ? (
        <div
          id="set-rooms"
          className={tabContentClass(activeTab, "rooms", "settings-tab-content--rooms")}
          style={isMobile ? undefined : tabDisplay(activeTab, "rooms")}
        >
          {isMobile ? (
            <button
              type="button"
              className="btn-primary tap-btn"
              onClick={() => modals.addRoomDraft()}
            >
              + Додати житло
            </button>
          ) : null}
          <table className="settings-rooms-table">
            {!isMobile ? (
              <thead>
                <tr>
                  <th>Назва</th>
                  <th>Місткість</th>
                  <th>Доступність</th>
                  <th>Дія</th>
                </tr>
              </thead>
            ) : null}
            <SettingsRoomsTable {...tableProps} />
          </table>
        </div>
        ) : null}

        {showTab("prices") ? (
        <div
          id="set-prices"
          className={tabContentClass(activeTab, "prices")}
          style={isMobile ? undefined : tabDisplay(activeTab, "prices")}
        >
          <DesktopPriceGrid
            settings={settings}
            modals={modals}
            baseDateRef={priceTimelineBaseDateRef}
            layout={layout}
            isTabActive={activeTab === "prices"}
            adminUndo={adminUndo}
          />
        </div>
        ) : null}

        {showTab("services") ? (
        <div
          id="set-services"
          className={tabContentClass(activeTab, "services")}
          style={isMobile ? undefined : tabDisplay(activeTab, "services")}
        >
          <AdditionalServicesSettingsPage settings={settings} modals={modals} />
        </div>
        ) : null}

        {showTab("discounts") ? (
        <div
          id="set-discounts"
          className={tabContentClass(activeTab, "discounts", "settings-tab-content--discounts")}
          style={isMobile ? undefined : tabDisplay(activeTab, "discounts")}
        >
          <DiscountTemplateGallery settings={settings} modals={modals} />
        </div>
        ) : null}

        {showTab("restrictions") ? (
        <div
          id="set-restrictions"
          className={tabContentClass(activeTab, "restrictions")}
          style={isMobile ? undefined : tabDisplay(activeTab, "restrictions")}
        >
          <DesktopRestrictionsGrid
            settings={settings}
            modals={modals}
            baseDateRef={restrictionsTimelineBaseDateRef}
            wrapperRef={restrictionsWrapperRef}
            layout={layout}
            isTabActive={activeTab === "restrictions"}
            adminUndo={adminUndo}
          />
        </div>
        ) : null}
      </div>
    </div>
  );
}
