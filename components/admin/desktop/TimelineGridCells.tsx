"use client";

import { memo } from "react";
import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { HOLDING_ROOM_ID } from "./timelineBookingMove";

export type TimelineGridCellProps = {
  dateString: string;
  isWeekend: boolean;
  isToday: boolean;
  roomKey: string;
  selectedClass: string;
  hoverClass: string;
  isDraggingOver: boolean;
  cellWidth: number;
  onMouseEnter: (roomKey: string, dateString: string) => void;
};

function cellPropsEqual(prev: TimelineGridCellProps, next: TimelineGridCellProps): boolean {
  return (
    prev.dateString === next.dateString &&
    prev.isWeekend === next.isWeekend &&
    prev.isToday === next.isToday &&
    prev.roomKey === next.roomKey &&
    prev.selectedClass === next.selectedClass &&
    prev.hoverClass === next.hoverClass &&
    prev.isDraggingOver === next.isDraggingOver &&
    prev.cellWidth === next.cellWidth &&
    prev.onMouseEnter === next.onMouseEnter
  );
}

export const TimelineGridCell = memo(function TimelineGridCell({
  dateString,
  isWeekend,
  isToday,
  roomKey,
  selectedClass,
  hoverClass,
  isDraggingOver,
  cellWidth,
  onMouseEnter,
}: TimelineGridCellProps) {
  const style: CSSProperties = {
    flex: `0 0 ${cellWidth}px`,
    width: cellWidth,
    minWidth: cellWidth,
    maxWidth: cellWidth,
    boxSizing: "border-box",
  };
  return (
    <div
      className={`timeline-cell${isWeekend ? " weekend" : ""}${isToday ? " today" : ""}${isDraggingOver ? " timeline-cell--drag-hover" : ""} ${selectedClass} ${hoverClass}`.trim()}
      data-room={roomKey}
      data-date={dateString}
      style={style}
      onMouseEnter={() => onMouseEnter(roomKey, dateString)}
    />
  );
}, cellPropsEqual);

export type TimelineGridRowProps = {
  rowId: string | number;
  rowIndex: number;
  isVirtualTimeline: boolean;
  gridTotalWidth: number;
  virtualOffsetPx: number;
  cellWidth: number;
  renderDays: { dateString: string; isWeekend: boolean; isToday: boolean }[];
  selectionKey: string;
  hoverPreviewKey: string;
  selectedClassForDate: (roomKey: string, dateString: string) => string;
  hoverClassForDate: (roomKey: string, dateString: string) => string;
  bookingDragHoverKey: string | null;
  onCellMouseEnter: (roomKey: string, dateString: string) => void;
  isPointerSelecting: boolean;
  onTrackPointerDown: (roomKey: string, event: PointerEvent<HTMLDivElement>) => void;
  onTrackPointerMove: (roomKey: string, event: PointerEvent<HTMLDivElement>) => void;
  onTrackPointerLeave: (roomKey: string) => void;
  roomKey: string;
  blocksSignature: string;
  children: ReactNode;
};

function rowPropsEqual(prev: TimelineGridRowProps, next: TimelineGridRowProps): boolean {
  return (
    prev.rowId === next.rowId &&
    prev.rowIndex === next.rowIndex &&
    prev.isVirtualTimeline === next.isVirtualTimeline &&
    prev.gridTotalWidth === next.gridTotalWidth &&
    prev.virtualOffsetPx === next.virtualOffsetPx &&
    prev.cellWidth === next.cellWidth &&
    prev.renderDays === next.renderDays &&
    prev.roomKey === next.roomKey &&
    prev.blocksSignature === next.blocksSignature &&
    prev.bookingDragHoverKey === next.bookingDragHoverKey &&
    prev.selectionKey === next.selectionKey &&
    prev.hoverPreviewKey === next.hoverPreviewKey &&
    prev.selectedClassForDate === next.selectedClassForDate &&
    prev.hoverClassForDate === next.hoverClassForDate &&
    prev.onCellMouseEnter === next.onCellMouseEnter &&
    prev.isPointerSelecting === next.isPointerSelecting &&
    prev.onTrackPointerDown === next.onTrackPointerDown &&
    prev.onTrackPointerMove === next.onTrackPointerMove &&
    prev.onTrackPointerLeave === next.onTrackPointerLeave
  );
}

export const TimelineGridRow = memo(function TimelineGridRow({
  rowId,
  rowIndex,
  isVirtualTimeline,
  gridTotalWidth,
  virtualOffsetPx,
  cellWidth,
  renderDays,
  selectedClassForDate,
  hoverClassForDate,
  bookingDragHoverKey,
  onCellMouseEnter,
  isPointerSelecting,
  onTrackPointerDown,
  onTrackPointerMove,
  onTrackPointerLeave,
  roomKey,
  children,
}: TimelineGridRowProps) {
  const isHolding = roomKey === String(HOLDING_ROOM_ID);
  return (
    <div
      className={`timeline-row-bg${isVirtualTimeline ? " timeline-row-bg--virtual" : ""}${isHolding ? " timeline-row-bg--holding" : ""}`}
      id={`grid-row-${rowIndex}`}
      style={{
        position: "relative",
        width: gridTotalWidth,
        minWidth: gridTotalWidth,
      }}
    >
      <div
        className={`timeline-track-window${isPointerSelecting ? " timeline-track-window--selecting" : ""}`}
        style={
          isVirtualTimeline
            ? { display: "flex", width: gridTotalWidth, minWidth: gridTotalWidth }
            : undefined
        }
        onPointerDown={(event) => onTrackPointerDown(roomKey, event)}
        onPointerMove={(event) => onTrackPointerMove(roomKey, event)}
        onPointerLeave={() => onTrackPointerLeave(roomKey)}
      >
        {isVirtualTimeline ? (
          <div
            aria-hidden
            className="timeline-track-spacer"
            style={{
              flex: `0 0 ${virtualOffsetPx}px`,
              width: virtualOffsetPx,
              minWidth: virtualOffsetPx,
              maxWidth: virtualOffsetPx,
            }}
          />
        ) : null}
        {renderDays.map((day) => (
          <TimelineGridCell
            key={day.dateString}
            dateString={day.dateString}
            isWeekend={day.isWeekend}
            isToday={day.isToday}
            roomKey={roomKey}
            cellWidth={cellWidth}
            selectedClass={selectedClassForDate(roomKey, day.dateString)}
            hoverClass={hoverClassForDate(roomKey, day.dateString)}
            isDraggingOver={bookingDragHoverKey === `${roomKey}:${day.dateString}`}
            onMouseEnter={onCellMouseEnter}
          />
        ))}
      </div>
      {children}
    </div>
  );
}, rowPropsEqual);
