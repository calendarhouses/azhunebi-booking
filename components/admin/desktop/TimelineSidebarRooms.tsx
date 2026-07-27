"use client";

import type { CSSProperties } from "react";
import { Maximize2, Minimize2, Undo2 } from "lucide-react";
import { RoomSidebarHouseIcon } from "@/components/ui/icons/RoomSidebarHouseIcon";
import { TimelineActionTooltip } from "./TimelineActionTooltip";
import { useGridFocusModeOptional } from "./GridFocusModeContext";
import type { RoomConfig } from "./types";
import { adminRoomLabel, adminRoomNumber } from "@/lib/admin/roomDisplay";
import "./timeline-sidebar-rooms.css";

export function timelineRoomsHeading(): "Будинки" {
  return "Будинки";
}

/** @deprecated Prefer `adminRoomLabel` from `@/lib/admin/roomDisplay`. */
export function roomSidebarDisplayName(room: Pick<RoomConfig, "name" | "short">): string {
  return adminRoomLabel(room);
}

export function TimelineSidebarHeader({
  roomCount: _roomCount,
  title,
  className = "",
  showFocusToggle = false,
  focusModeActive,
  onFocusToggle,
  onUndoMove,
  canUndoMove = false,
  isUndoing = false,
}: {
  roomCount?: number;
  /** Column caption; defaults to «Будинки» (шахматка passes «№»). */
  title?: string;
  className?: string;
  showFocusToggle?: boolean;
  /** Локальний toggle (напр. сітка цін), без GridFocusModeContext */
  focusModeActive?: boolean;
  onFocusToggle?: () => void;
  onUndoMove?: () => void;
  canUndoMove?: boolean;
  isUndoing?: boolean;
}) {
  const globalFocus = useGridFocusModeOptional();
  const useLocalFocus = onFocusToggle != null;
  const isFocusActive = useLocalFocus ? Boolean(focusModeActive) : globalFocus.isCompactMode;
  const toggleFocus = onFocusToggle ?? globalFocus.toggleCompactMode;

  return (
    <div className={`timeline-sidebar-header timeline-sidebar-header--khata ${className}`.trim()}>
      <span className="timeline-sidebar-header__title">
        {title || timelineRoomsHeading()}
      </span>
      <div className="timeline-sidebar-header__actions">
        {onUndoMove ? (
          <TimelineActionTooltip
            title="Назад"
            hint={
              isUndoing
                ? "Скасування…"
                : canUndoMove
                  ? "Скасувати останню дію · Ctrl+Z"
                  : "Немає дій для скасування"
            }
            disabled={isUndoing}
          >
            <button
              type="button"
              className={`timeline-undo-btn${isUndoing ? " timeline-undo-btn--busy" : ""}`}
              onClick={onUndoMove}
              disabled={!canUndoMove || isUndoing}
              aria-label="Скасувати останню дію"
              aria-busy={isUndoing}
            >
              <Undo2 className="timeline-undo-btn__icon" strokeWidth={2} aria-hidden />
            </button>
          </TimelineActionTooltip>
        ) : null}
        {showFocusToggle ? (
          <TimelineActionTooltip
            title={isFocusActive ? "Згорнути" : "Розгорнути"}
            hint={isFocusActive ? "Звичайний режим перегляду" : "Шахматка на весь екран"}
          >
            <button
              type="button"
              className="timeline-focus-toggle"
              onClick={toggleFocus}
              aria-pressed={isFocusActive}
              aria-label={isFocusActive ? "Згорнути шахматку" : "Розгорнути шахматку"}
            >
              {isFocusActive ? (
                <Minimize2 className="timeline-focus-toggle__icon" strokeWidth={2} aria-hidden />
              ) : (
                <Maximize2 className="timeline-focus-toggle__icon" strokeWidth={2} aria-hidden />
              )}
            </button>
          </TimelineActionTooltip>
        ) : null}
      </div>
    </div>
  );
}

export function TimelineRoomRow({
  room,
  className = "",
  showDesc = true,
  compact = false,
  numbersOnly = false,
  style,
}: {
  room: Pick<RoomConfig, "name" | "short" | "desc">;
  className?: string;
  showDesc?: boolean;
  compact?: boolean;
  /** Шахматка shows only the house number; other grids keep the full name. */
  numbersOnly?: boolean;
  style?: CSSProperties;
}) {
  const desc = room.desc?.trim();
  const fullLabel = roomSidebarDisplayName(room);
  const number = numbersOnly ? adminRoomNumber(room) : null;
  return (
    <div className={`timeline-room ${className}`.trim()} style={style}>
      <div
        className={`timeline-room__label${number ? " timeline-room__label--number" : ""}`}
      >
        {number ? null : (
          <RoomSidebarHouseIcon className="timeline-room__icon" />
        )}
        <span
          className={`timeline-room__name${number ? " timeline-room__name--number" : ""}`}
          title={number ? fullLabel : undefined}
        >
          {number || fullLabel}
        </span>
      </div>
      {showDesc && desc && !compact ? (
        <span className="timeline-room__desc">{desc}</span>
      ) : null}
    </div>
  );
}
