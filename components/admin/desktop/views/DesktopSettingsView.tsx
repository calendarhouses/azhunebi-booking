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
import { SettingsRoomsTable } from "../settings/DesktopSettingsTables";
import type { AdminModalsApi } from "../useAdminModals";
import { SETTINGS_FIT_CONTENT_TABS, SETTINGS_FULL_WIDTH_TABS } from "../settingsTabMeta";
import type { AdminSettingsPayload, SettingsTabName } from "../types";

function tabDisplay(active: SettingsTabName, tab: SettingsTabName): CSSProperties {
  return { display: active === tab ? "block" : "none" };
}

const MOBILE_SETTINGS_TABS: { tab: SettingsTabName; label: string }[] = [
  { tab: "branding", label: "Сторінка хати" },
  { tab: "rooms", label: "Твоє житло" },
  { tab: "prices", label: "Ціни та тарифи" },
  { tab: "restrictions", label: "Правила заїзду" },
  { tab: "discounts", label: "Знижки" },
];

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
  }, [activeTab]);

  const tableProps = { settings, modals, layout };
  const showTab = (tab: SettingsTabName) => !isMobile || activeTab === tab;

  const settingsContentClass = isMobile
    ? undefined
    : [
        "settings-content",
        SETTINGS_FIT_CONTENT_TABS.includes(activeTab) ? "settings-content--compact" : "",
        SETTINGS_FULL_WIDTH_TABS.includes(activeTab) ? "settings-content--full-width" : "",
      ]
        .filter(Boolean)
        .join(" ");

  return (
    <div id={isMobile ? "view-settings" : undefined} style={style}>
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
          className="settings-tab-content"
          style={isMobile ? undefined : tabDisplay(activeTab, "branding")}
        >
          <BrandingSettingsPanel
            settings={settings}
            onLogoPreviewChange={onLogoPreviewChange}
            onSettingsChange={onSettingsChange ?? (() => {})}
          />
        </div>
        ) : null}

        {showTab("rooms") ? (
        <div
          id="set-rooms"
          className="settings-tab-content settings-tab-content--rooms"
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
          className="settings-tab-content"
          style={isMobile ? undefined : tabDisplay(activeTab, "prices")}
        >
          <DesktopPriceGrid
            settings={settings}
            modals={modals}
            baseDateRef={priceTimelineBaseDateRef}
            layout={layout}
          />
        </div>
        ) : null}

        {showTab("restrictions") ? (
        <div
          id="set-restrictions"
          className="settings-tab-content"
          style={isMobile ? undefined : tabDisplay(activeTab, "restrictions")}
        >
          <DesktopRestrictionsGrid
            settings={settings}
            modals={modals}
            baseDateRef={restrictionsTimelineBaseDateRef}
            wrapperRef={restrictionsWrapperRef}
            layout={layout}
          />
        </div>
        ) : null}

        {showTab("discounts") ? (
        <div id="set-discounts" className="settings-tab-content settings-tab-content--discounts" style={isMobile ? undefined : tabDisplay(activeTab, "discounts")}>
          <DiscountTemplateGallery settings={settings} modals={modals} />
        </div>
        ) : null}
      </div>
    </div>
  );
}
