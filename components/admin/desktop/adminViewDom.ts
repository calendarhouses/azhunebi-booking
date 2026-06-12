import type { CSSProperties } from "react";
import { SETTINGS_TAB_META } from "./settingsTabMeta";
import type { AdminViewName, SettingsTabName } from "./types";

const FLEX_COLUMN_VIEWS: AdminViewName[] = ["grid", "reports", "settings"];
const FULL_HEIGHT_VIEWS: AdminViewName[] = ["grid", "reports"];

/** Як switchView / switchSettingsTab у old_boso_admin.html (display + меню + кнопка «Створити»). */
export function syncLegacyAdminViewDom(
  activeView: AdminViewName,
  options?: { settingsExpanded?: boolean; settingsTab?: SettingsTabName }
) {
  if (typeof document === "undefined") return;

  const views: AdminViewName[] = ["list", "grid", "guests", "settings", "reports"];
  for (const v of views) {
    const el = document.getElementById(`view-${v}`);
    if (!el) continue;
    el.style.display = "none";
    el.style.flex = "";
    el.style.flexDirection = "";
    el.style.height = "";
    el.style.minHeight = "";
  }

  const target = document.getElementById(`view-${activeView}`);
  if (target) {
    const isFlexCol = FLEX_COLUMN_VIEWS.includes(activeView);
    target.style.display = isFlexCol ? "flex" : "block";
    if (isFlexCol) {
      target.style.flexDirection = "column";
    }
    if (FULL_HEIGHT_VIEWS.includes(activeView)) {
      target.style.height = "100%";
      target.style.flex = "1";
      target.style.minHeight = "0";
    } else if (activeView === "settings") {
      target.style.height = "auto";
      target.style.flex = "1 1 auto";
      target.style.minHeight = "0";
    }
  }

  const mainBtn = document.getElementById("mainActionButton");
  if (mainBtn) {
    mainBtn.style.display =
      activeView === "reports" || activeView === "settings" ? "none" : "flex";
  }

  document.querySelectorAll(".menu-item").forEach((el) => el.classList.remove("active"));
  const menuId = activeView === "settings" ? "menu-settings" : `menu-${activeView}`;
  document.getElementById(menuId)?.classList.add("active");

  const submenu = document.getElementById("settings-submenu");
  const menuSettings = document.getElementById("menu-settings");
  const expanded = options?.settingsExpanded === true;
  if (submenu) submenu.classList.toggle("expanded", expanded);
  if (menuSettings) menuSettings.classList.toggle("expanded", expanded);

  document.querySelectorAll(".submenu-item").forEach((el) => el.classList.remove("active"));
  if (activeView === "settings" && options?.settingsTab) {
    const label = SETTINGS_TAB_META[options.settingsTab].title;
    document.querySelectorAll(".submenu-item").forEach((el) => {
      if (el.textContent?.trim() === label) el.classList.add("active");
    });
  }
}

/** Inline-стилі лише для visibility; flex/height — у admin-desktop.css */
export function getAdminViewStyle(view: AdminViewName, active: AdminViewName): CSSProperties {
  if (view !== active) return { display: "none" };
  if (view === "list" || view === "guests") return { display: "block" };
  if (view === "settings") return { display: "flex", flexDirection: "column" };
  return { display: "flex", flexDirection: "column", height: "100%" };
}
