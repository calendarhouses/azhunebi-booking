"use client";

import type { CSSProperties } from "react";
import { DesktopTimelineView } from "@/components/admin/desktop/views/DesktopTimelineView";
import type { BookingRecord, RoomConfig } from "@/components/admin/desktop/types";
import { bookingMoveKey } from "@/components/admin/desktop/timelineBookingMove";
import { useBookingMoveSave } from "./useBookingMoveSave";

export type AdminGridDashboardProps = {
  style?: CSSProperties;
  layout?: "desktop" | "mobile";
  roomsList?: RoomConfig[];
  bookings?: BookingRecord[];
  onOpenBooking: (event: React.MouseEvent | null, row: number | string) => void;
  onCreateBooking: (room: string, checkIn: string, checkOut: string) => void;
  onBookingUpdated?: (booking: BookingRecord) => void;
  onAfterBookingChange?: () => void | Promise<void>;
  onSessionExpired?: () => void | Promise<void>;
};

/** Шахматка бронювань. */
export function AdminGridDashboard({
  style,
  layout = "desktop",
  roomsList,
  bookings,
  onOpenBooking,
  onCreateBooking,
  onBookingUpdated,
  onAfterBookingChange,
  onSessionExpired,
}: AdminGridDashboardProps) {
  const handleMoveBooking = useBookingMoveSave({
    onBookingUpdated,
    onAfterBookingChange,
    onSessionExpired,
  });

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
          onMoveBooking={handleMoveBooking}
        />
      </div>
    </div>
  );
}

export { bookingMoveKey };
