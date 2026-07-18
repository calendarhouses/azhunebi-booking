"use client";

import { memo } from "react";
import type { PointerEvent, ReactNode } from "react";

export type TimelineGridCellProps = {
  dateString: string;
  isWeekend: boolean;
  roomName: string;
  selectedClass: string;
  hoverClass: string;
  isDraggingOver: boolean;
  onMouseEnter: (roomName: string, dateString: string) => void;
};

function cellPropsEqual(prev: TimelineGridCellProps, next: TimelineGridCellProps): boolean {
  return (
    prev.dateString === next.dateString &&
    prev.isWeekend === next.isWeekend &&
    prev.roomName === next.roomName &&
    prev.selectedClass === next.selectedClass &&
    prev.hoverClass === next.hoverClass &&
    prev.isDraggingOver === next.isDraggingOver &&
    prev.onMouseEnter === next.onMouseEnter
  );
}

export const TimelineGridCell = memo(function TimelineGridCell({
  dateString,
  isWeekend,
  roomName,
  selectedClass,
  hoverClass,
  isDraggingOver,
  onMouseEnter,
}: TimelineGridCellProps) {
  return (
    <div
      className={`timeline-cell${isWeekend ? " weekend" : ""}${isDraggingOver ? " timeline-cell--drag-hover" : ""} ${selectedClass} ${hoverClass}`.trim()}
      data-room={roomName}
      data-date={dateString}
      onMouseEnter={() => onMouseEnter(roomName, dateString)}
    />
  );
}, cellPropsEqual);

export type TimelineGridRowProps = {
  rowId: string | number;
  rowIndex: number;
  isVirtualTimeline: boolean;
  gridTotalWidth: number;
  virtualOffsetPx: number;
  renderDays: { dateString: string; isWeekend: boolean }[];
  selectionKey: string;
  hoverPreviewKey: string;
  selectedClassForDate: (roomName: string, dateString: string) => string;
  hoverClassForDate: (roomName: string, dateString: string) => string;
  bookingDragHoverKey: string | null;
  onCellMouseEnter: (roomName: string, dateString: string) => void;
  isPointerSelecting: boolean;
  onTrackPointerDown: (roomName: string, event: PointerEvent<HTMLDivElement>) => void;
  onTrackPointerMove: (roomName: string, event: PointerEvent<HTMLDivElement>) => void;
  onTrackPointerLeave: (roomName: string) => void;
  roomName: string;
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
    prev.renderDays === next.renderDays &&
    prev.roomName === next.roomName &&
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
  renderDays,
  selectedClassForDate,
  hoverClassForDate,
  bookingDragHoverKey,
  onCellMouseEnter,
  isPointerSelecting,
  onTrackPointerDown,
  onTrackPointerMove,
  onTrackPointerLeave,
  roomName,
  children,
}: TimelineGridRowProps) {
  return (
    <div
      className={`timeline-row-bg${isVirtualTimeline ? " timeline-row-bg--virtual" : ""}${roomName === "Нерозподілені" ? " timeline-row-bg--holding" : ""}`}
      id={`grid-row-${rowIndex}`}
      style={{
        position: "relative",
        width: gridTotalWidth,
        minWidth: gridTotalWidth,
      }}
    >
      <div
        className={`timeline-track-window${isPointerSelecting ? " timeline-track-window--selecting" : ""}`}
        style={isVirtualTimeline ? { marginLeft: virtualOffsetPx } : undefined}
        onPointerDown={(event) => onTrackPointerDown(roomName, event)}
        onPointerMove={(event) => onTrackPointerMove(roomName, event)}
        onPointerLeave={() => onTrackPointerLeave(roomName)}
      >
        {renderDays.map((day) => (
          <TimelineGridCell
            key={day.dateString}
            dateString={day.dateString}
            isWeekend={day.isWeekend}
            roomName={roomName}
            selectedClass={selectedClassForDate(roomName, day.dateString)}
            hoverClass={hoverClassForDate(roomName, day.dateString)}
            isDraggingOver={bookingDragHoverKey === `${roomName}:${day.dateString}`}
            onMouseEnter={onCellMouseEnter}
          />
        ))}
      </div>
      {children}
    </div>
  );
}, rowPropsEqual);
