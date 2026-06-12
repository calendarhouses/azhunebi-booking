"use client";

import { useEffect, useState } from "react";
import { MobileSheetHeader } from "./MobileSheetHeader";

export interface BookingQuickEditDrawerProps {
  open: boolean;
  title: string;
  value: number;
  defaultValue: number;
  maxAmount?: number;
  onClose: () => void;
  onSave: (value: number) => void;
}

/** Редагування суми — як #quickEditDrawer у old_boso_mobile.html */
export function BookingQuickEditDrawer({
  open,
  title,
  value,
  defaultValue,
  maxAmount,
  onClose,
  onSave,
}: BookingQuickEditDrawerProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (open) setDraft(String(value));
  }, [open, value]);

  if (!open) return null;

  return (
    <div id="quickEditDrawer" className="drawer-overlay active" style={{ zIndex: 2500 }}>
      <div className="drawer" style={{ maxHeight: "60vh" }}>
        <MobileSheetHeader
          title={<span id="qeTitle">Редагування: {title}</span>}
          onClose={onClose}
        />
        <div className="drawer-body" style={{ padding: 20, textAlign: "center" }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "#9CA3AF",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 12,
              display: "block",
            }}
          >
            Сума (грн)
          </label>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            id="qeInput"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{
              fontSize: 32,
              fontWeight: 800,
              padding: "16px 20px",
              borderRadius: 16,
              border: "2px solid var(--accent)",
              color: "var(--accent)",
              width: "100%",
              textAlign: "center",
              background: "#F8FAF7",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div
          className="drawer-footer booking-quick-edit-footer"
          style={{ flexDirection: "row", gap: 12, padding: "16px 20px calc(16px + var(--safe-bottom))" }}
        >
          <button
            type="button"
            className="btn-secondary"
            style={{ flex: 1, margin: 0, height: 46 }}
            onClick={() => setDraft(String(defaultValue))}
          >
            Скинути
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ flex: 2, margin: 0, height: 46 }}
            onClick={() => {
              let next = Math.max(0, Math.round(Number(draft) || 0));
              if (maxAmount !== undefined && Number.isFinite(maxAmount)) {
                next = Math.min(next, Math.max(0, Math.round(maxAmount)));
              }
              onSave(next);
              onClose();
            }}
          >
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
}
