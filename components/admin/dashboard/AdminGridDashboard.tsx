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
  onSettingsChange?: (next: AdminSettingsPayload) => void;
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
  onSettingsChange,
}: AdminGridDashboardProps) {
  const isMobile = layout === "mobile";
  const [pendingMove, setPendingMove] = useState<{
    booking: BookingRecord;
    room: RoomConfig;
    checkIn: string;
    checkOut: string;
    quote: NonNullable<ReturnType<typeof quoteMovedBooking>>;
  } | null>(null);

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
          settings={settings}
          onOpenBooking={onOpenBooking}
          onCreateBooking={onCreateBooking}
          onNewBooking={onNewBooking}
          onMoveBooking={handleMove}
          onUndoMove={() => adminUndo.undoLastInScope("booking")}
          canUndoMove={adminUndo.undoAvailable.booking}
          isUndoing={adminUndo.isUndoing}
          onTelegramTurnoversState={
            onSettingsChange
              ? (telegramTurnoversState) =>
                  onSettingsChange({ ...settings, telegramTurnoversState })
              : undefined
          }
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
