"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LineIcon } from "@/components/ui/LineIcon";
import { SidebarCollapsedItem } from "./SidebarCollapsedItem";
import { COLLAPSED_MAIN_NAV, EXPANDED_MENU_ICONS } from "./sidebarNavItems";
import { SIDEBAR_SETTINGS_ITEMS } from "./sidebarSettingsItems";
import type { AdminViewName, SettingsTabName } from "./types";

type SidebarCollapsedDockProps = {
  activeView: AdminViewName;
  settingsTab: SettingsTabName;
  settingsExpanded: boolean;
  settingsViewActive: boolean;
  onNavigate: (view: AdminViewName) => void;
  onSettingsTab: (tab: SettingsTabName) => void;
  onLogout: () => void;
};

export function SidebarCollapsedDock({
  activeView,
  settingsTab,
  settingsExpanded,
  settingsViewActive,
  onNavigate,
  onSettingsTab,
  onLogout,
}: SidebarCollapsedDockProps) {
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  const settingsActive = settingsViewActive || activeView === "settings" || settingsExpanded;

  const updatePopoverPos = useCallback(() => {
    const el = settingsButtonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPopoverPos({ top: rect.top + rect.height / 2, left: rect.right + 10 });
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    updatePopoverPos();
    window.addEventListener("resize", updatePopoverPos);
    window.addEventListener("scroll", updatePopoverPos, true);
    return () => {
      window.removeEventListener("resize", updatePopoverPos);
      window.removeEventListener("scroll", updatePopoverPos, true);
    };
  }, [settingsOpen, updatePopoverPos]);

  useEffect(() => {
    if (!settingsOpen) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const btn = settingsButtonRef.current;
      const popover = document.getElementById("sidebar-settings-popover-portal");
      if (btn?.contains(target)) return;
      if (popover?.contains(target)) return;
      setSettingsOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [settingsOpen]);

  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const handleSettingsClick = () => {
    setSettingsOpen((open) => !open);
  };

  const settingsPopover =
    settingsOpen && popoverPos && typeof document !== "undefined"
      ? createPortal(
          <div
            id="sidebar-settings-popover-portal"
            className="sidebar-settings-popover sidebar-settings-popover--portal sidebar-settings-popover--open"
            style={{ top: popoverPos.top, left: popoverPos.left }}
            role="menu"
          >
            {SIDEBAR_SETTINGS_ITEMS.map((item) => (
              <button
                key={item.tab}
                type="button"
                role="menuitem"
                className={`sidebar-settings-popover__item${
                  settingsViewActive && settingsTab === item.tab
                    ? " sidebar-settings-popover__item--active"
                    : ""
                }`}
                onClick={() => {
                  onNavigate("settings");
                  onSettingsTab(item.tab);
                  closeSettings();
                }}
              >
                <LineIcon className="sidebar-settings-popover__icon" size={16}>
                  {item.icon}
                </LineIcon>
                <span>{item.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="sidebar-collapsed-nav">
        <nav className="sidebar-collapsed-nav__main" aria-label="Головне меню">
          {COLLAPSED_MAIN_NAV.map((item) => (
            <SidebarCollapsedItem
              key={item.id}
              elementId={item.elementId}
              label={item.label}
              hint={item.hint}
              active={activeView === item.view && !settingsActive}
              onClick={() => {
                closeSettings();
                onNavigate(item.view);
              }}
            >
              {EXPANDED_MENU_ICONS[item.icon]}
            </SidebarCollapsedItem>
          ))}

          <SidebarCollapsedItem
            ref={settingsButtonRef}
            elementId="menu-settings"
            label="Налаштування"
            hint="Житло, ціни, знижки та профіль"
            active={settingsActive}
            showTooltip={!settingsOpen}
            ariaExpanded={settingsOpen}
            onClick={handleSettingsClick}
          >
            {EXPANDED_MENU_ICONS.settings}
          </SidebarCollapsedItem>

          <SidebarCollapsedItem
            elementId="menu-reports"
            label="Звіти"
            hint="Аналітика та фінанси"
            active={activeView === "reports" && !settingsActive}
            onClick={() => {
              closeSettings();
              onNavigate("reports");
            }}
          >
            {EXPANDED_MENU_ICONS.reports}
          </SidebarCollapsedItem>
        </nav>

        <div className="sidebar-collapsed-nav__footer">
          <SidebarCollapsedItem
            label="Вийти"
            hint="Завершити сесію"
            className="sidebar-collapsed-item--logout"
            onClick={onLogout}
          >
            {EXPANDED_MENU_ICONS.logout}
          </SidebarCollapsedItem>
        </div>
      </div>
      {settingsPopover}
    </>
  );
}
