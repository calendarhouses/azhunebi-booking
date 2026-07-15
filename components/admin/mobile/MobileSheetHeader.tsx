"use client";

import type { ReactNode } from "react";

export interface MobileSheetHeaderProps {
  title: ReactNode;
  onClose: () => void;
  className?: string;
}

/** Заголовок bottom-sheet (drawer/modal) як у old_boso_mobile.html */
export function MobileSheetHeader({ title, onClose, className = "drawer-header" }: MobileSheetHeaderProps) {
  return (
    <div
      className={className}
      style={{
        flexDirection: "column",
        alignItems: "stretch",
        padding: "12px 20px 16px",
      }}
    >
      <div className="m-sheet-handle drag-handle" aria-hidden />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
        {typeof title === "string" ? <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h2> : title}
        <button type="button" className="close-btn tap-btn" onClick={onClose} aria-label="Закрити">
          ✕
        </button>
      </div>
    </div>
  );
}
