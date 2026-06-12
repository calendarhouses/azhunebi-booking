"use client";

import { memo } from "react";
import type { ReactNode } from "react";

export type TimelineGridCellProps = {
  dateString: string;
  isWeekend: boolean;
  roomName: string;
  selectedClass: string;
  isDraggingOver: boolean;
  onMouseDown: (roomName: string, dateString: string) => void;
  onMouseEnter: (roomName: string, dateString: string) => void;
};

function cellPropsEqual(prev: TimelineGridCellProps, next: TimelineGridCellProps): boolean {
  return (
    prev.dateString === next.dateString &&
    prev.isWeekend === next.isWeekend &&
    prev.roomName === next.roomName &&
    prev.selectedClass === next.selectedClass &&
    prev.isDraggingOver === next.isDraggingOver &&
    prev.onMouseDown === next.onMouseDown &&
    prev.onMouseEnter === next.onMouseEnter
  );
}

export const TimelineGridCell = memo(function TimelineGridCell({
  dateString,
  isWeekend,
  roomName,
  selectedClass,
  isDraggingOver,
  onMouseDown,
  onMouseEnter,
}: TimelineGridCellProps) {
  return (
    <div
      className={`timeline-cell${isWeekend ? " weekend" : ""}${isDraggingOver ? " timeline-cell--drag-hover" : ""} ${selectedClass}`.trim()}
      data-room={roomName}
      data-date={dateString}
      onMouseDown={() => onMouseDown(roomName, dateString)}
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
  selectedClassForDate: (roomName: string, dateString: string) => string;
  bookingDragHoverKey: string | null;
  onCellMouseDown: (roomName: string, dateString: string) => void;
  onCellMouseEnter: (roomName: string, dateString: string) => void;
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
    prev.selectedClassForDate === next.selectedClassForDate &&
    prev.onCellMouseDown === next.onCellMouseDown &&
    prev.onCellMouseEnter === next.onCellMouseEnter
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
  bookingDragHoverKey,
  onCellMouseDown,
  onCellMouseEnter,
  roomName,
  children,
}: TimelineGridRowProps) {
  return (
    <div
      className={`timeline-row-bg${isVirtualTimeline ? " timeline-row-bg--virtual" : ""}`}
      id={`grid-row-${rowIndex}`}
      style={
        isVirtualTimeline
          ? { position: "relative", width: gridTotalWidth, minWidth: gridTotalWidth }
          : { position: "relative" }
      }
    >
      <div
        className="timeline-track-window"
        style={isVirtualTimeline ? { marginLeft: virtualOffsetPx } : undefined}
      >
        {renderDays.map((day) => (
          <TimelineGridCell
            key={day.dateString}
            dateString={day.dateString}
            isWeekend={day.isWeekend}
            roomName={roomName}
            selectedClass={selectedClassForDate(roomName, day.dateString)}
            isDraggingOver={bookingDragHoverKey === `${roomName}:${day.dateString}`}
            onMouseDown={onCellMouseDown}
            onMouseEnter={onCellMouseEnter}
          />
        ))}
      </div>
      {children}
    </div>
  );
}, rowPropsEqual);
