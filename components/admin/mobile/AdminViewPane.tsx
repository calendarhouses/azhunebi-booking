"use client";

import type { CSSProperties, ReactNode } from "react";
import type { AdminViewName } from "../desktop/types";

export interface AdminViewPaneProps {
  view: AdminViewName;
  active: AdminViewName;
  children: ReactNode;
  style?: CSSProperties;
}

/** Рендерить лише активний view — інакше приховані settings/restrictions потрапляють у скрол шахматки. */
export function AdminViewPane({ view, active, children, style }: AdminViewPaneProps) {
  if (view !== active) return null;

  const base: CSSProperties =
    view === "list" || view === "guests"
      ? { display: "block", width: "100%" }
      : view === "reports"
        ? { display: "flex", flexDirection: "column", height: "100%", paddingBottom: 30, width: "100%" }
        : { display: "block", width: "100%" };

  return <div style={{ ...base, ...style }}>{children}</div>;
}
