"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { DesktopPriceGrid } from "../settings/DesktopPriceGrid";
import {
  DesktopRestrictionsGrid,
  scrollToRestrictionsGrid,
} from "../settings/DesktopRestrictionsGrid";
import { BrandingSettingsPanel } from "../settings/BrandingSettingsPanel";
import { TeamSettingsPanel } from "../settings/TeamSettingsPanel";
import { DiscountTemplateGallery } from "../settings/DiscountTemplateGallery";
import { AdditionalServicesSettingsPage } from "../settings/AdditionalServicesSettingsPage";
import { SmsSettingsPanel } from "../settings/SmsSettingsPanel";
import { PaymentSettingsPanel } from "../settings/PaymentSettingsPanel";
import { SettingsRoomsTable } from "../settings/DesktopSettingsTables";
import { SIDEBAR_SETTINGS_ITEMS } from "../sidebarSettingsItems";
import type { AdminModalsApi } from "../useAdminModals";
import type { AdminUndoApi } from "@/components/admin/undo/useAdminUndo";
import { SETTINGS_FIT_CONTENT_TABS, SETTINGS_FULL_WIDTH_TABS } from "../settingsTabMeta";
import type { AdminSettingsPayload, BookingRecord, SettingsTabName } from "../types";

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

const MOBILE_SETTINGS_TABS = SIDEBAR_SETTINGS_ITEMS.map(({ tab, label, icon }) => ({ tab, label, icon }));
const MOBILE_SETTINGS_DESCRIPTIONS: Record<SettingsTabName, string> = {
  branding: "Контакти, логотип і правила перебування",
  rooms: "Котеджі, місткість, ціни та зручності",
  prices: "Тарифи для дат і окремих будинків",
  services: "Гнучкий графік і пропозиції для гостей",
  discounts: "Акції, промокоди та спеціальні умови",
  restrictions: "Мінімальні ночі та закриті дати",
  payment: "Онлайн-оплата Mono, ключ і передплата",
  sms: "Шаблони, баланс TurboSMS і журнал відправок",
  team: "Команда та журнал змін в адмінці",
  activity: "Команда та журнал змін в адмінці",
};

export interface DesktopSettingsViewProps {
  style?: CSSProperties;
  layout?: "desktop" | "mobile";
  settings: AdminSettingsPayload;
  tenantName?: string | null;
  onLogoPreviewChange?: (nextUrl: string | null) => void;
  onSettingsChange?: (next: AdminSettingsPayload) => void;
  activeTab?: SettingsTabName;
  onSettingsTab?: (tab: SettingsTabName) => void;
  onLogout?: () => void;
  modals: AdminModalsApi;
  priceTimelineBaseDateRef: React.MutableRefObject<Date>;
  restrictionsTimelineBaseDateRef: React.MutableRefObject<Date>;
  adminUndo: AdminUndoApi;
  bookings?: BookingRecord[];
  onShowGuestBookings?: (phone: string, name: string) => void;
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
  onLogout,
  modals,
  priceTimelineBaseDateRef,
  restrictionsTimelineBaseDateRef,
  adminUndo,
  bookings = [],
  onShowGuestBookings,
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
  const activeMobileTab = MOBILE_SETTINGS_TABS.find(({ tab }) => tab === activeTab);

  const handleMobileTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const lastIndex = MOBILE_SETTINGS_TABS.length - 1;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? lastIndex
          : event.key === "ArrowRight"
            ? (index + 1) % MOBILE_SETTINGS_TABS.length
            : (index - 1 + MOBILE_SETTINGS_TABS.length) % MOBILE_SETTINGS_TABS.length;
    const nextTab = MOBILE_SETTINGS_TABS[nextIndex].tab;
    onSettingsTab?.(nextTab);
    window.requestAnimationFrame(() => {
      document.getElementById(`mobile-settings-tab-${nextTab}`)?.focus();
    });
  };

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
        <div className="mobile-settings-shell">
          <header className="mobile-settings-heading">
            <span className="mobile-settings-heading__eyebrow">Налаштування</span>
            <h2>{activeMobileTab?.label ?? "Налаштування"}</h2>
            <p>{MOBILE_SETTINGS_DESCRIPTIONS[activeTab]}</p>
          </header>
          <div className="mobile-settings-tabs" role="tablist" aria-label="Налаштування">
            {MOBILE_SETTINGS_TABS.map(({ tab, label, icon }, index) => (
              <button
                key={tab}
                id={`mobile-settings-tab-${tab}`}
                type="button"
                className={`m-tab tap-btn${activeTab === tab ? " active" : ""}`}
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`set-${tab}`}
                tabIndex={activeTab === tab ? 0 : -1}
                onClick={() => onSettingsTab?.(tab)}
                onKeyDown={(event) => handleMobileTabKeyDown(event, index)}
              >
                <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
                  {icon}
                </svg>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={settingsContentClass}>
        {showTab("branding") ? (
        <div
          id="set-branding"
          className={tabContentClass(activeTab, "branding")}
          role={isMobile ? "tabpanel" : undefined}
          aria-labelledby={isMobile ? "mobile-settings-tab-branding" : undefined}
          style={isMobile ? undefined : tabDisplay(activeTab, "branding")}
        >
          <BrandingSettingsPanel
            settings={settings}
            onLogoPreviewChange={onLogoPreviewChange}
            onSettingsChange={onSettingsChange ?? (() => {})}
            isActive={activeTab === "branding"}
            showAccountLogout={isMobile}
            onLogout={onLogout}
            onOpenPaymentTab={() => onSettingsTab?.("payment")}
          />
        </div>
        ) : null}

        {showTab("rooms") ? (
        <div
          id="set-rooms"
          className={tabContentClass(activeTab, "rooms", "settings-tab-content--rooms")}
          role={isMobile ? "tabpanel" : undefined}
          aria-labelledby={isMobile ? "mobile-settings-tab-rooms" : undefined}
          style={isMobile ? undefined : tabDisplay(activeTab, "rooms")}
        >
          {isMobile ? (
            <button
              type="button"
              className="btn-primary tap-btn"
              onClick={() => {
                const draftId = modals.addRoomDraft();
                modals.openRoomDrawer(draftId);
              }}
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
          role={isMobile ? "tabpanel" : undefined}
          aria-labelledby={isMobile ? "mobile-settings-tab-prices" : undefined}
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
          role={isMobile ? "tabpanel" : undefined}
          aria-labelledby={isMobile ? "mobile-settings-tab-services" : undefined}
          style={isMobile ? undefined : tabDisplay(activeTab, "services")}
        >
          <AdditionalServicesSettingsPage settings={settings} modals={modals} />
        </div>
        ) : null}

        {showTab("discounts") ? (
        <div
          id="set-discounts"
          className={tabContentClass(activeTab, "discounts", "settings-tab-content--discounts")}
          role={isMobile ? "tabpanel" : undefined}
          aria-labelledby={isMobile ? "mobile-settings-tab-discounts" : undefined}
          style={isMobile ? undefined : tabDisplay(activeTab, "discounts")}
        >
          <DiscountTemplateGallery settings={settings} modals={modals} />
        </div>
        ) : null}

        {showTab("restrictions") ? (
        <div
          id="set-restrictions"
          className={tabContentClass(activeTab, "restrictions")}
          role={isMobile ? "tabpanel" : undefined}
          aria-labelledby={isMobile ? "mobile-settings-tab-restrictions" : undefined}
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

        {showTab("payment") ? (
        <div
          id="set-payment"
          className={tabContentClass(activeTab, "payment")}
          role={isMobile ? "tabpanel" : undefined}
          aria-labelledby={isMobile ? "mobile-settings-tab-payment" : undefined}
          style={isMobile ? undefined : tabDisplay(activeTab, "payment")}
        >
          <PaymentSettingsPanel
            settings={settings}
            onSettingsChange={onSettingsChange ?? (() => {})}
            isActive={activeTab === "payment"}
          />
        </div>
        ) : null}

        {showTab("sms") ? (
        <div
          id="set-sms"
          className={tabContentClass(activeTab, "sms")}
          role={isMobile ? "tabpanel" : undefined}
          aria-labelledby={isMobile ? "mobile-settings-tab-sms" : undefined}
          style={isMobile ? undefined : tabDisplay(activeTab, "sms")}
        >
          <SmsSettingsPanel
            settings={settings}
            onSettingsChange={onSettingsChange ?? (() => {})}
            isActive={activeTab === "sms"}
            bookings={bookings}
            onShowGuestBookings={onShowGuestBookings}
          />
        </div>
        ) : null}

        {showTab("team") ? (
        <div
          id="set-team"
          className={tabContentClass(activeTab, "team")}
          role={isMobile ? "tabpanel" : undefined}
          aria-labelledby={isMobile ? "mobile-settings-tab-team" : undefined}
          style={isMobile ? undefined : tabDisplay(activeTab, "team")}
        >
          <TeamSettingsPanel isActive={activeTab === "team"} />
        </div>
        ) : null}
      </div>
    </div>
  );
}
