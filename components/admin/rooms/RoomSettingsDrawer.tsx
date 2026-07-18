"use client";

import { useEffect } from "react";
import type { AdminModalsApi } from "@/components/admin/desktop/useAdminModals";
import type { AdminSettingsPayload } from "@/components/admin/desktop/types";
import { useMobileUi } from "@/components/admin/mobile/MobileUiContext";
import { RoomSettingsAccordion } from "./RoomSettingsAccordion";
import { cn } from "./room-drawer-ui";

type Props = {
  open: boolean;
  title: string;
  roomId: number | null;
  settings: AdminSettingsPayload;
  modals: AdminModalsApi;
  loading?: boolean;
  onClose: () => void;
};

export function RoomSettingsDrawer({
  open,
  title,
  roomId,
  settings,
  modals,
  loading = false,
  onClose,
}: Props) {
  const isMobile = useMobileUi();
  const room =
    roomId == null ? null : (settings.roomsList || []).find((r) => r.id === roomId) ?? null;

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const html = document.documentElement;
    const prevBody = document.body.style.overflow;
    const prevHtml = html.style.overflow;
    document.body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
    };
  }, [open]);

  return (
    <div
      className={cn(
        "room-settings-drawer-layer fixed inset-0 z-[3200] transition-opacity duration-300",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="room-settings-drawer-backdrop absolute inset-0 bg-slate-900/40 backdrop-blur-[4px]"
        onClick={onClose}
        aria-label="Закрити панель"
      />
      <aside
        className={cn(
          "room-settings-drawer room-settings-drawer--premium flex flex-col bg-white antialiased",
          isMobile
            ? cn(
                "absolute bottom-0 left-0 right-0 max-h-[94dvh] w-full rounded-t-[24px]",
                "shadow-[0_-16px_40px_rgba(15,23,42,0.12)]",
                "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                "pb-[env(safe-area-inset-bottom,0px)]",
                open ? "translate-y-0" : "translate-y-full"
              )
            : cn(
                "absolute right-0 top-0 h-full w-full max-w-2xl",
                "shadow-[-16px_0_40px_rgba(15,23,42,0.08)]",
                "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                open ? "translate-x-0" : "translate-x-full"
              )
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-drawer-title"
      >
        {isMobile ? <div className="m-sheet-handle mt-3 shrink-0" aria-hidden /> : null}

        <header className="room-settings-drawer__header shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="room-drawer-title" className="room-settings-drawer__title">
                {title}
              </h2>
              <p className="room-settings-drawer__subtitle">
                Основна інформація, галерея, зручності, правила та базові ціни
              </p>
            </div>
            <button
              type="button"
              className="room-settings-drawer__close"
              onClick={onClose}
              aria-label="Закрити"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="room-settings-drawer__body flex-1 overflow-y-auto">
          {loading ? (
            <div className="room-settings-drawer__skeleton" aria-hidden>
              <div />
              <div />
              <div />
              <div />
              <div />
            </div>
          ) : roomId != null && room ? (
            <RoomSettingsAccordion
              key={roomId}
              roomKey={roomId}
              room={room}
              settings={settings}
              modals={modals}
              initialStepId="info"
              onSaved={onClose}
              onDeleted={onClose}
            />
          ) : (
            <p className="room-settings-drawer__empty">Житло не знайдено. Закрийте вікно й спробуйте знову.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
