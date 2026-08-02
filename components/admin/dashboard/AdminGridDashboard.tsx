"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { DesktopTimelineView } from "@/components/admin/desktop/views/DesktopTimelineView";
import type { AdminSettingsPayload, BookingRecord, RoomConfig } from "@/components/admin/desktop/types";
import {
  applyBookingMove,
  bookingMoveKey,
  isHoldingRoom,
} from "@/components/admin/desktop/timelineBookingMove";
import { quoteMovedBooking } from "@/components/admin/desktop/bookingMovePricing";
import { adminApiFetch } from "@/components/admin/desktop/adminApi";
import { showToast } from "@/components/admin/desktop/adminGlobals";
import type { AdminUndoApi } from "@/components/admin/undo/useAdminUndo";

export type AdminGridDashboardProps = {
  style?: CSSProperties;
  layout?: "desktop" | "mobile";
  roomsList?: RoomConfig[];
  bookings?: BookingRecord[];
  settings: AdminSettingsPayload;
  onOpenBooking: (event: React.MouseEvent | null, row: number | string) => void;
  onCreateBooking: (room: string, checkIn: string, checkOut: string) => void;
  onNewBooking?: () => void;
  adminUndo: AdminUndoApi;
};

/** Шахматка бронювань. */
export function AdminGridDashboard({
  style,
  layout = "desktop",
  roomsList,
  bookings,
  settings,
  onOpenBooking,
  onCreateBooking,
  onNewBooking,
  adminUndo,
}: AdminGridDashboardProps) {
  const isMobile = layout === "mobile";
  const [cleaningSyncBusy, setCleaningSyncBusy] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    booking: BookingRecord;
    room: RoomConfig;
    checkIn: string;
    checkOut: string;
    quote: NonNullable<ReturnType<typeof quoteMovedBooking>>;
  } | null>(null);

  const syncCleaningNotifications = async () => {
    if (cleaningSyncBusy) return;
    setCleaningSyncBusy(true);
    try {
      const res = await adminApiFetch("/api/admin/cleaning-notify/sync", {
        method: "POST",
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        sent?: number;
        edited?: number;
        deleted?: number;
        unchanged?: number;
        error?: string;
        errors?: string[];
      } | null;
      if (!res.ok || !data) {
        showToast(data?.error || "Не вдалося оновити прибирання");
        return;
      }
      if (data.errors?.length) {
        console.warn("[cleaning-notify]", data.errors);
        const stateErr = data.errors.find((e) => e.startsWith("load_state:"));
        if (stateErr) {
          showToast("Спочатку задеплой GAS (cleaning telegram state)");
          return;
        }
      }
      const parts: string[] = [];
      if (data.sent) parts.push(`+${data.sent}`);
      if (data.edited) parts.push(`✎${data.edited}`);
      if (data.deleted) parts.push(`−${data.deleted}`);
      if (!parts.length && data.unchanged) {
        showToast("Прибирання вже актуальне");
      } else if (!parts.length) {
        showToast(data.ok ? "Немає заїздів/виїздів на сьогодні" : "Помилка оновлення");
      } else {
        showToast(`Прибирання: ${parts.join(" · ")}`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Не вдалося оновити прибирання");
    } finally {
      setCleaningSyncBusy(false);
    }
  };

  const handleMove = (
    booking: BookingRecord,
    room: RoomConfig,
    checkIn: string,
    checkOut: string
  ) => {
    if (isHoldingRoom(room)) {
      adminUndo.handleMoveBooking(booking, room, checkIn, checkOut);
      return;
    }
    const quote = quoteMovedBooking(
      booking,
      room,
      checkIn,
      checkOut,
      settings,
      bookings || []
    );
    if (!quote || quote.oldTotal === quote.newTotal) {
      adminUndo.handleMoveBooking(booking, room, checkIn, checkOut);
      return;
    }
    setPendingMove({ booking, room, checkIn, checkOut, quote });
  };

  const commitPending = (changePrice: boolean) => {
    if (!pendingMove) return;
    adminUndo.handleMoveBooking(
      pendingMove.booking,
      pendingMove.room,
      pendingMove.checkIn,
      pendingMove.checkOut,
      changePrice ? pendingMove.quote.overrides : undefined
    );
    setPendingMove(null);
  };

  const cancelPending = () => {
    setPendingMove(null);
  };

  useEffect(() => {
    if (!pendingMove) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelPending();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
  const displayBookings = pendingMove
    ? (bookings || []).map((booking) =>
        bookingMoveKey(booking) === bookingMoveKey(pendingMove.booking)
          ? applyBookingMove(
              booking,
              pendingMove.room,
              pendingMove.checkIn,
              pendingMove.checkOut
            )
          : booking
      )
    : bookings;

  return (
    <div
      id="view-grid"
      className={`admin-grid-dashboard${isMobile ? " admin-grid-dashboard--mobile-fill" : ""}`}
      style={style}
    >
      <div className={`admin-grid-timeline-host${isMobile ? "" : " flex flex-col min-w-0 h-fit"}`}>
        <div className="admin-grid-cleaning-bar">
          <button
            type="button"
            className={`btn-secondary admin-grid-cleaning-sync${isMobile ? " tap-btn" : ""}${cleaningSyncBusy ? " is-busy" : ""}`}
            onClick={() => void syncCleaningNotifications()}
            disabled={cleaningSyncBusy}
            title="Оновити сповіщення в групі ПРИБИРАННЯ"
          >
            {cleaningSyncBusy ? "Оновлення…" : "Оновити"}
          </button>
        </div>
        <DesktopTimelineView
          layout={layout}
          useViewRootId={false}
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            ...(isMobile ? { flex: "1 1 0%", minHeight: 0 } : {}),
          }}
          roomsList={roomsList}
          bookings={displayBookings}
          onOpenBooking={onOpenBooking}
          onCreateBooking={onCreateBooking}
          onNewBooking={onNewBooking}
          onMoveBooking={handleMove}
          onUndoMove={() => adminUndo.undoLastInScope("booking")}
          canUndoMove={adminUndo.undoAvailable.booking}
          isUndoing={adminUndo.isUndoing}
        />
        {pendingMove ? (
          <div
            className="booking-move-price-overlay"
            role="presentation"
            onClick={cancelPending}
          >
            <div
              className="booking-move-price-popover"
              role="dialog"
              aria-modal="true"
              onClick={(event) => event.stopPropagation()}
            >
              <strong>Перерахувати ціну?</strong>
              <div className="booking-move-price-values">
                {pendingMove.quote.oldTotal.toLocaleString("uk-UA")} ₴
                <span>→</span>
                {pendingMove.quote.newTotal.toLocaleString("uk-UA")} ₴
              </div>
              <div className="booking-move-price-actions">
                <button type="button" onClick={() => commitPending(false)}>
                  Залишити
                </button>
                <button type="button" className="primary" onClick={() => commitPending(true)}>
                  Змінити ціну
                </button>
                <button
                  type="button"
                  className="booking-move-price-cancel"
                  onClick={cancelPending}
                >
                  Відмінити
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { bookingMoveKey };
