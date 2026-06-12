"use client";

import { LineIcon } from "@/components/ui/LineIcon";
import { SIDEBAR_SETTINGS_ITEMS } from "./sidebarSettingsItems";
import type { SettingsTabName } from "./types";

export function SettingsSubmenu({
  expanded,
  activeTab,
  settingsViewActive,
  onSelect,
}: {
  expanded: boolean;
  activeTab: SettingsTabName;
  /** Підсвітка пункту лише коли відкрито розділ налаштувань у main-content */
  settingsViewActive: boolean;
  onSelect: (tab: SettingsTabName) => void;
}) {
  return (
    <div className={`submenu${expanded ? " expanded" : ""}`} id="settings-submenu">
      {SIDEBAR_SETTINGS_ITEMS.map(({ tab, label, icon }) => (
        <div
          key={tab}
          className={`submenu-item${settingsViewActive && activeTab === tab ? " active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(tab);
          }}
        >
          <span className="submenu-icon-wrap">
            <LineIcon className="submenu-icon-svg" size={16}>
              {icon}
            </LineIcon>
          </span>
          <span className="submenu-label">{label}</span>
        </div>
      ))}
    </div>
  );
}
