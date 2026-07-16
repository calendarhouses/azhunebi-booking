"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

/** Редагування суми — bottom sheet поверх booking drawer (portal у body). */
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) setDraft(String(value));
  }, [open, value]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      id="quickEditDrawer"
      className="drawer-overlay active booking-quick-edit-overlay"
      style={{ zIndex: 3600 }}
      onClick={onClose}
    >
      <div
        className="drawer booking-quick-edit-sheet"
        style={{ maxHeight: "min(60dvh, 420px)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qeTitle"
      >
        <MobileSheetHeader
          title={<span id="qeTitle">{title}</span>}
          onClose={onClose}
        />
        <div className="drawer-body" style={{ padding: 20, textAlign: "center", flex: "0 0 auto" }}>
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
            autoFocus
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
        <div className="drawer-footer booking-quick-edit-footer drawer-footer--mobile">
          <div className="drawer-footer-actions">
            <button
              type="button"
              className="btn-secondary"
              style={{ flex: 1, margin: 0, height: 46 }}
              onClick={onClose}
            >
              Скасувати
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ flex: 1.2, margin: 0, height: 46 }}
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
    </div>,
    document.body
  );
}
