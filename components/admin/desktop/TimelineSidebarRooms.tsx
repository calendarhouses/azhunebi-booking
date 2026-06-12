"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { RoomSidebarHouseIcon } from "@/components/ui/icons/RoomSidebarHouseIcon";
import { useGridFocusModeOptional } from "./GridFocusModeContext";
import type { RoomConfig } from "./types";

export function timelineRoomsHeading(): "ЖИТЛО" {
  return "ЖИТЛО";
}

export function roomSidebarDisplayName(room: Pick<RoomConfig, "name" | "short">): string {
  const name = room.name?.trim();
  if (name) return name;
  return room.short?.trim() || "Назва житла";
}

function TimelineSidebarHeadingWord() {
  const label = timelineRoomsHeading();

  return (
    <span className="timeline-sidebar-header__word" aria-label={label}>
      <span className="timeline-sidebar-header__letter">Ж</span>
      <span className="timeline-sidebar-header__letter">И</span>
      <span className="timeline-sidebar-header__letter">Т</span>
      <span className="timeline-sidebar-header__letter">Л</span>
      <span className="timeline-sidebar-header__letter">О</span>
    </span>
  );
}

export function TimelineSidebarHeader({
  roomCount: _roomCount,
  className = "",
  showFocusToggle = false,
}: {
  roomCount?: number;
  className?: string;
  showFocusToggle?: boolean;
}) {
  const { isCompactMode, toggleCompactMode } = useGridFocusModeOptional();

  return (
    <div className={`timeline-sidebar-header timeline-sidebar-header--khata ${className}`.trim()}>
      <TimelineSidebarHeadingWord />
      {showFocusToggle ? (
        <button
          type="button"
          className="timeline-focus-toggle"
          onClick={toggleCompactMode}
          aria-pressed={isCompactMode}
          aria-label={isCompactMode ? "Вимкнути компактний режим" : "Увімкнути компактний режим"}
          title={isCompactMode ? "Звичайний режим" : "Focus Mode"}
        >
          {isCompactMode ? (
            <Minimize2 className="timeline-focus-toggle__icon" strokeWidth={2} aria-hidden />
          ) : (
            <Maximize2 className="timeline-focus-toggle__icon" strokeWidth={2} aria-hidden />
          )}
        </button>
      ) : null}
    </div>
  );
}

export function TimelineRoomRow({
  room,
  className = "",
  showDesc = true,
  compact = false,
}: {
  room: Pick<RoomConfig, "name" | "short" | "desc">;
  className?: string;
  showDesc?: boolean;
  compact?: boolean;
}) {
  const desc = room.desc?.trim();
  return (
    <div className={`timeline-room ${className}`.trim()}>
      <div className="timeline-room__label">
        <RoomSidebarHouseIcon className="timeline-room__icon" />
        <span className="timeline-room__name">{roomSidebarDisplayName(room)}</span>
      </div>
      {showDesc && desc && !compact ? (
        <span className="timeline-room__desc">{desc}</span>
      ) : null}
    </div>
  );
}
