"use client";

import type { PublicRoom } from "@/lib/public-booking/types";
import { getRoomDescription } from "@/lib/public-booking/desktopRoomContent";
import { formatRoomDisplayName } from "@/lib/public-booking/roomDisplay";
import { DesktopIcons } from "@/lib/public-booking/desktopIcons";

type DrawerRoomHeaderProps = {
  room: PublicRoom;
  nextFreeLabel: string;
};

export function DrawerRoomHeader({ room, nextFreeLabel }: DrawerRoomHeaderProps) {
  const description = getRoomDescription(room);
  const guestCount = room.maxCapacity || room.capacity;

  return (
    <header className="drawer-room-header">
      <h2 className="detail-title" id="detailTitle">
        {formatRoomDisplayName(room)}
      </h2>

      {description ? (
        <p className="drawer-room-header__desc" id="detailDesc">
          {description}
        </p>
      ) : null}

      <div className="drawer-room-stats">
        <div className="drawer-room-stat">
          <div className="drawer-room-stat__icon" aria-hidden>
            {DesktopIcons.guests}
          </div>
          <div className="drawer-room-stat__body">
            <span className="drawer-room-stat__label">Місткість</span>
            <span className="drawer-room-stat__value">До {guestCount} гостей</span>
          </div>
        </div>

        <div className="drawer-room-stat drawer-room-stat--free">
          <div className="drawer-room-stat__icon" aria-hidden>
            {DesktopIcons.calendar}
          </div>
          <div className="drawer-room-stat__body">
            <span className="drawer-room-stat__label">Вільний</span>
            <span className="drawer-room-stat__value">{nextFreeLabel}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
