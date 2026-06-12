"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { BrandingSettingsPanel } from "../../desktop/settings/BrandingSettingsPanel";
import { DesktopPriceGrid } from "../../desktop/settings/DesktopPriceGrid";
import {
  DesktopRestrictionsGrid,
  scrollToRestrictionsGrid,
} from "../../desktop/settings/DesktopRestrictionsGrid";
import type { AdminModalsApi } from "../../desktop/useAdminModals";
import type { AdminSettingsPayload, RoomConfig, SettingsTabName } from "../../desktop/types";

/** Таби — як <div class="m-tab"> у old_boso_mobile.html */
const MOBILE_SETTINGS_TABS: { tab: SettingsTabName; label: string }[] = [
  { tab: "branding", label: "Сторінка хати" },
  { tab: "rooms", label: "Твоє житло" },
  { tab: "prices", label: "Ціни та тарифи" },
  { tab: "restrictions", label: "Правила заїзду" },
  { tab: "discounts", label: "Знижки" },
];

function tabPaneStyle(active: SettingsTabName, tab: SettingsTabName): CSSProperties | undefined {
  return active === tab ? undefined : { display: "none" };
}

function SettingsRoomsTableBody({
  rooms,
  onEdit,
}: {
  rooms: RoomConfig[];
  onEdit: (id: number) => void;
}) {
  if (rooms.length === 0) {
    return (
      <tbody id="settingsRoomsTableBody">
        <tr>
          <td
            colSpan={1}
            style={{
              padding: "28px 16px",
              textAlign: "center",
              color: "#6B7280",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            У вас ще немає доданих котеджів
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody id="settingsRoomsTableBody">
      {rooms.map((r) => {
        const badge = r.active ? (
          <span className="badge confirmed" style={{ fontSize: 10, padding: "2px 8px" }}>
            Увімкнено
          </span>
        ) : (
          <span className="badge cancelled" style={{ fontSize: 10, padding: "2px 8px" }}>
            Вимкнено
          </span>
        );
        return (
          <tr key={r.id}>
            <td
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong>{r.name}</strong>
              {badge}
            </td>
            <td style={{ fontSize: 13, color: "#6B7280" }}>
              Місткість: від {r.capacity} до {r.maxCapacity || r.capacity} гостей
            </td>
            <td
              style={{
                justifyContent: "flex-end",
                gap: 8,
                paddingTop: 10,
                borderTop: "1px solid #F3F4F6",
              }}
            >
              <button
                type="button"
                className="btn-action"
                style={{
                  padding: "10px 16px",
                  fontSize: 14,
                  flex: 1,
                  justifyContent: "center",
                }}
                onClick={() => onEdit(r.id)}
              >
                Редагувати котедж
              </button>
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}

function SettingsDiscountsTableBody({
  discounts,
  onEdit,
}: {
  discounts: AdminSettingsPayload["discountsList"];
  onEdit: (id: number) => void;
}) {
  const list = discounts || [];
  return (
    <tbody id="settingsDiscountsTableBody">
      {list.map((d) => {
        const roomsText = d.rooms.replace("Всі котеджі", "Всі котеджі");
        return (
          <tr key={d.id}>
            <td
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1 }}>
                <strong>{d.condition}</strong>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="badge confirmed" style={{ fontSize: 14 }}>
                  {d.discount}
                </span>
              </div>
            </td>
            <td style={{ fontSize: 12, color: "#6B7280" }}>Застосовано: {roomsText}</td>
            <td style={{ justifyContent: "flex-end", paddingTop: 10 }}>
              <button
                type="button"
                className="btn-action"
                style={{
                  padding: "10px 16px",
                  fontSize: 14,
                  width: "100%",
                  justifyContent: "center",
                }}
                onClick={() => onEdit(d.id)}
              >
                Редагувати знижку
              </button>
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}

export interface MobileSettingsViewProps {
  settings: AdminSettingsPayload;
  tenantName?: string | null;
  onSettingsChange?: (next: AdminSettingsPayload) => void;
  activeTab: SettingsTabName;
  onSettingsTab: (tab: SettingsTabName) => void;
  modals: AdminModalsApi;
  priceTimelineBaseDateRef: React.MutableRefObject<Date>;
  restrictionsTimelineBaseDateRef: React.MutableRefObject<Date>;
}

/** Розмітка 1:1 з old_boso_mobile.html #view-settings */
export function MobileSettingsView({
  settings,
  tenantName,
  onSettingsChange,
  activeTab,
  onSettingsTab,
  modals,
  priceTimelineBaseDateRef,
  restrictionsTimelineBaseDateRef,
}: MobileSettingsViewProps) {
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

  const rooms = settings.roomsList || [];

  useEffect(() => {
    const main = document.querySelector(".boso-admin-mobile .main-content");
    if (main) main.scrollTop = 0;
  }, []);

  useEffect(() => {
    const main = document.querySelector(".boso-admin-mobile .main-content");
    if (main) main.scrollTop = 0;
  }, [activeTab]);

  return (
    <div id="view-settings" style={{ display: "flex", flexDirection: "column" }}>
      <button
        type="button"
        className="btn-secondary mobile-logout-btn tap-btn"
        onClick={() => {
          (window as Window & { BosoAuth?: { logout?: () => void } }).BosoAuth?.logout?.();
        }}
      >
        Вийти з акаунту
      </button>

      <div className="mobile-settings-tabs">
        {MOBILE_SETTINGS_TABS.map(({ tab, label }) => (
          <div
            key={tab}
            className={`m-tab${activeTab === tab ? " active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => onSettingsTab(tab)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSettingsTab(tab);
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <div id="set-branding" className="settings-tab-content" style={tabPaneStyle(activeTab, "branding")}>
        <BrandingSettingsPanel
          settings={settings}
          onSettingsChange={onSettingsChange ?? (() => {})}
        />
      </div>

      <div id="set-rooms" className="settings-tab-content" style={tabPaneStyle(activeTab, "rooms")}>
        <button
          type="button"
          className="btn-primary"
          style={{ marginBottom: 16 }}
          onClick={() => modals.openRoomDrawer(null)}
        >
          + Додати житло
        </button>
        <table>
          <SettingsRoomsTableBody rooms={rooms} onEdit={(id) => modals.openRoomDrawer(id)} />
        </table>
      </div>

      <div id="set-prices" className="settings-tab-content" style={tabPaneStyle(activeTab, "prices")}>
        <DesktopPriceGrid
          settings={settings}
          modals={modals}
          baseDateRef={priceTimelineBaseDateRef}
          layout="mobile"
        />
      </div>

      <div id="set-restrictions" className="settings-tab-content" style={tabPaneStyle(activeTab, "restrictions")}>
        <DesktopRestrictionsGrid
          settings={settings}
          modals={modals}
          baseDateRef={restrictionsTimelineBaseDateRef}
          wrapperRef={restrictionsWrapperRef}
          layout="mobile"
        />
      </div>

      <div id="set-discounts" className="settings-tab-content" style={tabPaneStyle(activeTab, "discounts")}>
        <button
          type="button"
          className="btn-primary"
          style={{ marginBottom: 16 }}
          onClick={() => modals.openGenericModal("discount")}
        >
          + Додати знижку
        </button>
        <table>
          <SettingsDiscountsTableBody
            discounts={settings.discountsList}
            onEdit={(id) => modals.openGenericModal("discount", id)}
          />
        </table>
      </div>
    </div>
  );
}
