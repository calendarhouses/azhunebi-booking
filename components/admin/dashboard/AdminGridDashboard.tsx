"use client";

import type { CSSProperties } from "react";
import { DesktopTimelineView } from "@/components/admin/desktop/views/DesktopTimelineView";
import type { BookingRecord, RoomConfig } from "@/components/admin/desktop/types";
import { bookingMoveKey } from "@/components/admin/desktop/timelineBookingMove";
import type { AdminUndoApi } from "@/components/admin/undo/useAdminUndo";

export type AdminGridDashboardProps = {
  style?: CSSProperties;
  layout?: "desktop" | "mobile";
  roomsList?: RoomConfig[];
  bookings?: BookingRecord[];
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
  onOpenBooking,
  onCreateBooking,
  onNewBooking,
  adminUndo,
}: AdminGridDashboardProps) {
  return (
    <div id="view-grid" className="admin-grid-dashboard" style={style}>
      <div className="admin-grid-timeline-host flex flex-col min-w-0 h-fit">
        <DesktopTimelineView
          layout={layout}
          useViewRootId={false}
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
          }}
          roomsList={roomsList}
          bookings={bookings}
          onOpenBooking={onOpenBooking}
          onCreateBooking={onCreateBooking}
          onNewBooking={onNewBooking}
          onMoveBooking={adminUndo.handleMoveBooking}
          onUndoMove={() => adminUndo.undoLastInScope("booking")}
          canUndoMove={adminUndo.undoAvailable.booking}
          isUndoing={adminUndo.isUndoing}
        />
      </div>
    </div>
  );
}

export { bookingMoveKey };
