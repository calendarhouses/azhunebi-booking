"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { toImageDisplaySrc } from "@/lib/driveImageUrl";
import { loadAdminNav, patchAdminNav } from "@/lib/admin/adminNavPersistence";
import { useGridFocusModeOptional } from "./GridFocusModeContext";
import { LineIcon } from "@/components/ui/LineIcon";
import { SettingsSubmenu } from "./SidebarSubmenu";
import { SidebarCollapsedDock } from "./SidebarCollapsedDock";
import { SidebarNavTooltip } from "./SidebarNavTooltip";
import { getTenantInitials } from "./sidebarBrand";
import { EXPANDED_MENU_ICONS } from "./sidebarNavItems";
import type { AdminViewName, SettingsTabName } from "./types";

export interface DesktopSidebarProps {
  activeView: AdminViewName;
  settingsExpanded: boolean;
  settingsTab: SettingsTabName;
  tenantId?: string;
  tenantName?: string | null;
  tenantPlan?: string | null;
  publicBookUrl?: string;
  logoPreviewUrl?: string | null;
  onNavigate: (view: AdminViewName) => void;
  onToggleSettings: () => void;
  onSettingsTab: (tab: SettingsTabName) => void;
}

function menuClass(active: boolean) {
  return `menu-item${active ? " active" : ""}`;
}

const BRAND_TIP_TITLE = "Публічна сторінка бронювання";
const BRAND_TIP_HINT = "Клікни на лого, щоб відкрити";
const BRAND_TIP_DELAY_MS = 420;

function SidebarBrandLink({
  href,
  className,
  children,
  showPremiumTip,
}: {
  href: string;
  className: string;
  children: ReactNode;
  showPremiumTip: boolean;
}) {
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null);

  const hideTip = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    setTip(null);
  }, []);

  const showTip = useCallback(() => {
    if (!showPremiumTip) return;
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    showTimerRef.current = setTimeout(() => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setTip({ top: rect.top + rect.height / 2, left: rect.right + 14 });
    }, BRAND_TIP_DELAY_MS);
  }, [showPremiumTip]);

  return (
    <>
      <a
        ref={anchorRef}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label="Відкрити публічну сторінку бронювання"
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        onFocus={showTip}
        onBlur={hideTip}
      >
        {children}
      </a>
      {tip && typeof document !== "undefined"
        ? createPortal(
            <div
              className="sidebar-nav-tip sidebar-nav-tip--portal"
              style={{ top: tip.top, left: tip.left }}
              role="tooltip"
            >
              <span className="sidebar-nav-tip__body">
                <span className="sidebar-nav-tip__title">{BRAND_TIP_TITLE}</span>
                <span className="sidebar-nav-tip__hint">{BRAND_TIP_HINT}</span>
              </span>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export function DesktopSidebar({
  activeView,
  settingsExpanded,
  settingsTab,
  tenantId,
  tenantName,
  publicBookUrl,
  logoPreviewUrl,
  onNavigate,
  onToggleSettings,
  onSettingsTab,
}: DesktopSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarBeforeFocusRef = useRef<boolean | null>(null);
  const { isCompactMode } = useGridFocusModeOptional();

  useEffect(() => {
    if (!tenantId) return;
    const saved = loadAdminNav(tenantId);
    if (saved?.sidebarCollapsed) setCollapsed(true);
  }, [tenantId]);

  useEffect(() => {
    if (isCompactMode) {
      setCollapsed((prev) => {
        if (sidebarBeforeFocusRef.current === null) {
          sidebarBeforeFocusRef.current = prev;
        }
        if (prev) return prev;
        if (tenantId) patchAdminNav(tenantId, { sidebarCollapsed: true });
        return true;
      });
      return;
    }

    if (sidebarBeforeFocusRef.current === null) return;
    const restore = sidebarBeforeFocusRef.current;
    sidebarBeforeFocusRef.current = null;
    setCollapsed(restore);
    if (tenantId) patchAdminNav(tenantId, { sidebarCollapsed: restore });
  }, [isCompactMode, tenantId]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (tenantId) patchAdminNav(tenantId, { sidebarCollapsed: next });
      return next;
    });
  }, [tenantId]);

  const settingsActive = activeView === "settings" || settingsExpanded;
  const brandTitle = (tenantName || "").trim() || "Панель керування";
  const initials = getTenantInitials(brandTitle);

  const settingsChevron = (
    <svg
      className="chevron"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );

  const logoNode = logoPreviewUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={toImageDisplaySrc(logoPreviewUrl)}
      alt="Лого хати"
      className={collapsed ? "sidebar-collapsed-brand__img" : "sidebar-brand-widget__logo"}
      referrerPolicy="no-referrer"
    />
  ) : (
    <div className="sidebar-brand-avatar" aria-hidden>
      {initials}
    </div>
  );

  const sidebarClass = ["sidebar", collapsed ? "sidebar--collapsed" : ""].filter(Boolean).join(" ");

  const collapseToggleButton = (
    <button
      type="button"
      className="sidebar-collapse-toggle"
      onClick={toggleCollapsed}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Розгорнути меню" : "Згорнути меню"}
    >
      {collapsed ? (
        <PanelLeftOpen className="sidebar-collapse-toggle__icon" strokeWidth={1.75} aria-hidden />
      ) : (
        <PanelLeftClose className="sidebar-collapse-toggle__icon" strokeWidth={1.75} aria-hidden />
      )}
      <span className="sidebar-collapse-toggle__label">
        {collapsed ? "Розгорнути" : "Згорнути"}
      </span>
    </button>
  );

  return (
    <aside className={sidebarClass}>
      <div className="sidebar-header">
        <div className={`sidebar-brand${collapsed ? " sidebar-brand--compact" : ""}`}>
          {collapsed ? (
            publicBookUrl ? (
              <SidebarBrandLink
                href={publicBookUrl}
                showPremiumTip
                className="sidebar-collapsed-brand group"
              >
                {logoNode}
              </SidebarBrandLink>
            ) : (
              <div className="sidebar-collapsed-brand group" aria-label={brandTitle}>
                {logoNode}
              </div>
            )
          ) : publicBookUrl ? (
            <SidebarBrandLink
              href={publicBookUrl}
              showPremiumTip={false}
              className="sidebar-brand-widget sidebar-brand-widget--expanded group"
            >
              {logoNode}
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-title">{brandTitle}</span>
              </div>
              <LineIcon className="sidebar-brand-external" size={16}>
                <path d="M15 3h6v6" />
                <path d="M10 14 21 3" />
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </LineIcon>
            </SidebarBrandLink>
          ) : (
            <div className="sidebar-brand-widget sidebar-brand-widget--expanded">
              {logoNode}
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-title">{brandTitle}</span>
              </div>
            </div>
          )}
        </div>

        {collapsed ? (
          <SidebarNavTooltip title="Розгорнути" hint="Показати повне меню">
            {(handlers) => (
              <span className="sidebar-collapse-toggle-wrap" {...handlers}>
                {collapseToggleButton}
              </span>
            )}
          </SidebarNavTooltip>
        ) : (
          collapseToggleButton
        )}
      </div>

      <div className="sidebar-nav-body">
      {collapsed ? (
        <SidebarCollapsedDock
          activeView={activeView}
          settingsTab={settingsTab}
          settingsExpanded={settingsExpanded}
          settingsViewActive={activeView === "settings"}
          onNavigate={onNavigate}
          onSettingsTab={onSettingsTab}
          onLogout={() => {
            if (typeof window !== "undefined") {
              (window as Window & { BosoAuth?: { logout?: () => void } }).BosoAuth?.logout?.();
            }
          }}
        />
      ) : (
        <>
          <div
            className={menuClass(activeView === "grid")}
            id="menu-grid"
            onClick={() => onNavigate("grid")}
          >
            <div className="menu-item-content">
              <span className="menu-icon-wrap">{EXPANDED_MENU_ICONS.grid}</span>
              <span className="menu-item-label">Шахматка</span>
            </div>
          </div>

          <div
            className={menuClass(activeView === "list")}
            id="menu-list"
            onClick={() => onNavigate("list")}
          >
            <div className="menu-item-content">
              <span className="menu-icon-wrap">{EXPANDED_MENU_ICONS.list}</span>
              <span className="menu-item-label">Усі броні</span>
            </div>
          </div>

          <div
            className={menuClass(activeView === "guests")}
            id="menu-guests"
            onClick={() => onNavigate("guests")}
          >
            <div className="menu-item-content">
              <span className="menu-icon-wrap">{EXPANDED_MENU_ICONS.guests}</span>
              <span className="menu-item-label">Гості</span>
            </div>
          </div>

          <div
            className={`${menuClass(settingsActive)}${settingsExpanded ? " expanded" : ""}`}
            id="menu-settings"
            onClick={onToggleSettings}
          >
            <div className="menu-item-content">
              <span className="menu-icon-wrap">{EXPANDED_MENU_ICONS.settings}</span>
              <span className="menu-item-label">Налаштування</span>
            </div>
            {settingsChevron}
          </div>

          <SettingsSubmenu
            expanded={settingsExpanded}
            activeTab={settingsTab}
            settingsViewActive={activeView === "settings"}
            onSelect={onSettingsTab}
          />

          <div
            className={menuClass(activeView === "reports")}
            id="menu-reports"
            onClick={() => onNavigate("reports")}
          >
            <div className="menu-item-content">
              <span className="menu-icon-wrap">{EXPANDED_MENU_ICONS.reports}</span>
              <span className="menu-item-label">Звіти</span>
            </div>
          </div>

          <div className="sidebar-logout-wrap">
            <div
              className="menu-item logout-item"
              onClick={() => {
                if (typeof window !== "undefined") {
                  (window as Window & { BosoAuth?: { logout?: () => void } }).BosoAuth?.logout?.();
                }
              }}
            >
              <div className="menu-item-content">
                <span className="menu-icon-wrap">{EXPANDED_MENU_ICONS.logout}</span>
                <span className="menu-item-label">Вийти</span>
              </div>
            </div>
          </div>
        </>
      )}
      </div>
    </aside>
  );
}
