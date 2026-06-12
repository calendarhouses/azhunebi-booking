import type { CSSProperties } from "react";
import type { AdminViewName, SettingsTabName } from "../desktop/types";
import { SETTINGS_TAB_META } from "../desktop/settingsTabMeta";
import { MOBILE_TOP_TITLES } from "./mobileTopTitles";

const FLEX_COLUMN_VIEWS: AdminViewName[] = ["grid", "reports", "settings"];
const FULL_HEIGHT_VIEWS: AdminViewName[] = ["grid", "reports"];

/** Синхронізація видимості view + bottom nav + top bar (old_boso_mobile.html). */
export function syncMobileAdminViewDom(
  activeView: AdminViewName,
  options?: { settingsTab?: SettingsTabName; settingsExpanded?: boolean }
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
    if (isFlexCol) target.style.flexDirection = "column";
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

  document.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));
  const navId =
    activeView === "settings" ? "nav-settings" : `nav-${activeView}`;
  document.getElementById(navId)?.classList.add("active");

  const titleEl = document.getElementById("mobileTopTitle");
  if (titleEl) {
    titleEl.textContent =
      activeView === "settings" && options?.settingsTab
        ? SETTINGS_TAB_META[options.settingsTab].title
        : MOBILE_TOP_TITLES[activeView] ?? MOBILE_TOP_TITLES.grid;
  }

  if (activeView === "settings" && options?.settingsTab) {
    document.querySelectorAll(".mobile-settings-tabs .m-tab").forEach((el) => {
      el.classList.remove("active");
    });
    const label = SETTINGS_TAB_META[options.settingsTab].title;
    document.querySelectorAll(".mobile-settings-tabs .m-tab").forEach((el) => {
      if (el.textContent?.trim() === label) el.classList.add("active");
    });
  }
}

export function getMobileViewStyle(view: AdminViewName, active: AdminViewName): CSSProperties {
  if (view !== active) return { display: "none" };
  if (view === "list" || view === "guests") return { display: "block" };
  if (view === "settings") return { display: "flex", flexDirection: "column" };
  return { display: "flex", flexDirection: "column", height: "100%" };
}
