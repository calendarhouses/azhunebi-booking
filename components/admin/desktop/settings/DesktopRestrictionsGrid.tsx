"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type WheelEvent,
} from "react";
import { formatDateKey } from "../bookingUtils";
import { useGridFocusModeOptional } from "../GridFocusModeContext";
import {
  applyDragEdgeScroll,
  isNearDragScrollEdge,
  type DragScrollTargets,
} from "../timelineDragAutoScroll";
import { TimelineSidebarHeader, TimelineRoomRow } from "../TimelineSidebarRooms";
import { getRuleCellKind, isPriceWeekend, type RuleCellKind } from "./restrictionGridUtils";
import {
  formatMonthYearLabel,
  PRICE_CELL_MIN,
  PRICE_GRID_DATES_HEIGHT,
  PRICE_GRID_HEADER_HEIGHT,
  PRICE_GRID_MONTH_HEIGHT,
  PRICE_ROW_HEIGHT,
} from "./priceGridUtils";
import { buildRuleGridSelectionPreset } from "./ruleConstructorLogic";
import type { AdminModalsApi } from "../useAdminModals";
import type { AdminUndoApi } from "@/components/admin/undo/useAdminUndo";
import type { AdminSettingsPayload } from "../types";

const DAYS_LABELS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const DRAG_THRESHOLD_PX = 5;

type DragHighlight = { roomIds: string[]; dateStrs: string[] };

function measureRuleCellWidth(kind: RuleCellKind, minNights: number): number {
  const label = kind === "closed" ? "Закрито" : kind === "minNights" ? `${minNights} мін` : "";
  if (!label) return PRICE_CELL_MIN;
  return Math.max(PRICE_CELL_MIN, Math.ceil(label.length * 6.8) + 16);
}

function getCellSelectionClasses(
  highlight: DragHighlight | null,
  roomId: string,
  dateStr: string
): string[] {
  if (!highlight) return [];
  if (!highlight.roomIds.includes(roomId) || !highlight.dateStrs.includes(dateStr)) return [];

  const rowIdx = highlight.roomIds.indexOf(roomId);
  const sortedDates = [...highlight.dateStrs].sort();
  const classes = ["cell-selected"];
  if (dateStr === sortedDates[0]) classes.push("cell-selected-start");
  if (dateStr === sortedDates[sortedDates.length - 1]) classes.push("cell-selected-end");
  if (rowIdx === 0) classes.push("cell-selected-row-first");
  if (rowIdx === highlight.roomIds.length - 1) classes.push("cell-selected-row-last");
  return classes;
}

function RuleGridCell({
  kind,
  minNights,
  isWeekend,
  width,
  dragSelectionClasses: selectionClasses,
  onDragMouseDown,
  onDragMouseEnter,
  onOpenConstructor,
}: {
  kind: RuleCellKind;
  minNights: number;
  isWeekend: boolean;
  width: number;
  dragSelectionClasses: string[];
  onDragMouseDown: (e: React.MouseEvent) => void;
  onDragMouseEnter: () => void;
  onOpenConstructor: () => void;
}) {
  const cellClass = [
    "price-cell",
    "rule-cell",
    "timeline-cell",
    "flex shrink-0 items-center justify-center",
    "border-r border-stone-100",
    "cursor-pointer",
    isWeekend ? "price-cell--weekend bg-[#fafaf9]" : "bg-white",
    kind === "closed" ? "rule-cell--closed" : "",
    kind === "minNights" ? "rule-cell--min-nights" : "",
    ...selectionClasses,
  ]
    .filter(Boolean)
    .join(" ");

  const cellStyle = { width, minWidth: width, height: "100%", alignSelf: "stretch" as const };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cellClass}
      style={cellStyle}
      onDoubleClick={(e) => {
        e.preventDefault();
        onOpenConstructor();
      }}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        onDragMouseDown(e);
      }}
      onMouseEnter={onDragMouseEnter}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenConstructor();
        }
      }}
    >
      <div className="flex h-full w-full flex-col items-center justify-center whitespace-nowrap px-2">
        {kind === "closed" ? (
          <span className="text-xs font-bold text-red-700">Закрито</span>
        ) : kind === "minNights" ? (
          <>
            <span className="text-sm font-semibold text-stone-800">{minNights}</span>
            <span className="text-[10px] font-medium text-stone-500">мін</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

export interface DesktopRestrictionsGridProps {
  settings: AdminSettingsPayload;
  modals: AdminModalsApi;
  baseDateRef: React.MutableRefObject<Date>;
  wrapperRef?: React.RefObject<HTMLDivElement | null>;
  layout?: "desktop" | "mobile";
  isTabActive?: boolean;
  adminUndo: AdminUndoApi;
}

export function DesktopRestrictionsGrid({
  settings,
  modals,
  baseDateRef,
  layout = "desktop",
  isTabActive = true,
  adminUndo,
}: DesktopRestrictionsGridProps) {
  const isMobile = layout === "mobile";
  const [, bump] = useState(0);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const compactGrid = !isMobile && isFocusMode;
  const { setAuxiliaryFocusActive } = useGridFocusModeOptional();
  const scrollRef = useRef<HTMLDivElement>(null);
  const headTrackRef = useRef<HTMLDivElement>(null);
  const sidebarBodyScrollRef = useRef<HTMLDivElement>(null);
  const scrollSyncRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const lastDragFramePointerRef = useRef({ x: 0, y: 0 });
  const dragAutoScrollRafRef = useRef<number | null>(null);
  const settingsMainRef = useRef<HTMLElement | null>(null);
  const [dragHighlight, setDragHighlight] = useState<DragHighlight | null>(null);
  const dragRef = useRef({
    active: false,
    anchorRoomId: "",
    anchorDateStr: "",
    focusRoomId: "",
    focusDateStr: "",
    moved: false,
    startX: 0,
    startY: 0,
  });
  const columnWidthsRef = useRef<number[]>([]);
  const scrollPreserveRef = useRef<number | null>(null);

  const startDate = useMemo(() => {
    const d = new Date(baseDateRef.current);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [baseDateRef.current.getTime(), bump]);

  const daysCount = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
  const monthLabel = formatMonthYearLabel(startDate);
  const activeRooms = (settings.roomsList || []).filter((r) => r.active);
  const roomIdOrder = useMemo(() => activeRooms.map((r) => String(r.id)), [activeRooms]);

  const dayMeta = useMemo(() => {
    return Array.from({ length: daysCount }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      return {
        date: d,
        dateStr: formatDateKey(d),
        isWeekend: isPriceWeekend(d),
      };
    });
  }, [startDate, daysCount]);

  const toggleFocusMode = useCallback(() => {
    setIsFocusMode((prev) => !prev);
  }, []);

  const syncFocusHeadTrack = useCallback((scrollLeft: number) => {
    const track = headTrackRef.current;
    if (!track) return;
    track.style.transform = `translate3d(${-scrollLeft}px, 0, 0)`;
  }, []);

  const handleGridContainerScroll = useCallback(() => {
    if (scrollSyncRef.current) return;
    const grid = scrollRef.current;
    const sidebar = sidebarBodyScrollRef.current;
    if (!grid) return;

    scrollSyncRef.current = true;
    if (compactGrid) syncFocusHeadTrack(grid.scrollLeft);
    if (sidebar && sidebar.scrollTop !== grid.scrollTop) {
      sidebar.scrollTop = grid.scrollTop;
    }
    scrollSyncRef.current = false;
  }, [compactGrid, syncFocusHeadTrack]);

  const handleSidebarBodyScroll = useCallback(() => {
    if (scrollSyncRef.current) return;
    const sidebar = sidebarBodyScrollRef.current;
    const grid = scrollRef.current;
    if (!sidebar || !grid) return;

    scrollSyncRef.current = true;
    if (grid.scrollTop !== sidebar.scrollTop) {
      grid.scrollTop = sidebar.scrollTop;
    }
    scrollSyncRef.current = false;
  }, []);

  const handleGridWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (!compactGrid) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const sidebar = sidebarBodyScrollRef.current;
      if (!sidebar) return;
      event.preventDefault();
      sidebar.scrollTop += event.deltaY;
    },
    [compactGrid]
  );

  const computeDragHighlight = useCallback(
    (anchorRoomId: string, focusRoomId: string, anchorDateStr: string, focusDateStr: string) => {
      const r1 = roomIdOrder.indexOf(anchorRoomId);
      const r2 = roomIdOrder.indexOf(focusRoomId);
      if (r1 < 0 || r2 < 0) return null;

      const dateStrs = dayMeta.map((d) => d.dateStr);
      const d1 = dateStrs.indexOf(anchorDateStr);
      const d2 = dateStrs.indexOf(focusDateStr);
      if (d1 < 0 || d2 < 0) return null;

      return {
        roomIds: roomIdOrder.slice(Math.min(r1, r2), Math.max(r1, r2) + 1),
        dateStrs: dateStrs.slice(Math.min(d1, d2), Math.max(d1, d2) + 1),
      };
    },
    [roomIdOrder, dayMeta]
  );

  const columnWidths = useMemo(() => {
    const widths = Array.from({ length: daysCount }, () => PRICE_CELL_MIN);

    for (const room of activeRooms) {
      dayMeta.forEach((day, i) => {
        const { kind, minNights } = getRuleCellKind(settings, room.id, day.date);
        widths[i] = Math.max(widths[i], measureRuleCellWidth(kind, minNights));
      });
    }

    return widths;
  }, [activeRooms, dayMeta, daysCount, settings]);

  columnWidthsRef.current = columnWidths;

  const gridTotalWidth = useMemo(
    () => columnWidths.reduce((sum, w) => sum + w, 0),
    [columnWidths]
  );

  const shift = (months: number) => {
    baseDateRef.current.setMonth(baseDateRef.current.getMonth() + months);
    bump((n) => n + 1);
  };

  const resetToToday = () => {
    baseDateRef.current = new Date();
    baseDateRef.current.setDate(1);
    bump((n) => n + 1);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as Window & {
      shiftRestrictionsTimeline?: (months: number) => void;
      resetRestrictionsTimelineToToday?: () => void;
      scrollToRestrictionsGrid?: () => void;
      renderRestrictionsGrid?: () => void;
    };
    w.shiftRestrictionsTimeline = shift;
    w.resetRestrictionsTimelineToToday = resetToToday;
    w.renderRestrictionsGrid = () => bump((n) => n + 1);
    w.scrollToRestrictionsGrid = () => {
      document.getElementById("set-restrictions")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    return () => {
      delete w.shiftRestrictionsTimeline;
      delete w.resetRestrictionsTimelineToToday;
      delete w.renderRestrictionsGrid;
      delete w.scrollToRestrictionsGrid;
    };
  }, [shift, resetToToday]);

  useEffect(() => {
    if (isMobile) return;
    settingsMainRef.current = document.querySelector(".main-content.main-content--settings");
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) return;
    const active = isTabActive && isFocusMode;
    setAuxiliaryFocusActive(active);
    return () => setAuxiliaryFocusActive(false);
  }, [isFocusMode, isMobile, isTabActive, setAuxiliaryFocusActive]);

  useEffect(() => {
    if (!isTabActive && isFocusMode) setIsFocusMode(false);
  }, [isTabActive, isFocusMode]);

  useEffect(() => {
    if (isMobile) return;
    const main = document.querySelector(".main-content.main-content--settings");
    if (!isTabActive || !isFocusMode) {
      main?.classList.remove("main-content--price-grid-focus");
      return;
    }
    main?.classList.add("main-content--price-grid-focus");
    return () => {
      main?.classList.remove("main-content--price-grid-focus");
    };
  }, [isFocusMode, isMobile, isTabActive]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const widths = columnWidthsRef.current;
    const today = new Date();
    if (
      startDate.getMonth() === today.getMonth() &&
      startDate.getFullYear() === today.getFullYear()
    ) {
      const dayIdx = today.getDate() - 1;
      const offset = widths.slice(0, Math.max(0, dayIdx - 3)).reduce((a, b) => a + b, 0);
      el.scrollLeft = offset;
      if (compactGrid) syncFocusHeadTrack(offset);
    } else {
      el.scrollLeft = 0;
      if (compactGrid) syncFocusHeadTrack(0);
    }
  }, [startDate, daysCount, compactGrid, syncFocusHeadTrack]);

  const getDragScrollTargets = useCallback((): DragScrollTargets => {
    if (compactGrid) {
      return {
        horizontal: scrollRef.current,
        vertical: scrollRef.current,
        verticalSync: sidebarBodyScrollRef.current,
      };
    }
    return {
      horizontal: scrollRef.current,
      verticalPage: settingsMainRef.current,
    };
  }, [compactGrid]);

  const stopDragAutoScroll = useCallback(() => {
    if (dragAutoScrollRafRef.current != null) {
      cancelAnimationFrame(dragAutoScrollRafRef.current);
      dragAutoScrollRafRef.current = null;
    }
  }, []);

  const runDragAutoScrollFrame = useCallback(() => {
    const drag = dragRef.current;
    if (!drag.active) {
      dragAutoScrollRafRef.current = null;
      return;
    }

    const targets = getDragScrollTargets();
    const { x, y } = lastPointerRef.current;
    const nearEdge = isNearDragScrollEdge(x, y, targets);
    const moved =
      x !== lastDragFramePointerRef.current.x || y !== lastDragFramePointerRef.current.y;

    if (!moved && !nearEdge) {
      dragAutoScrollRafRef.current = null;
      return;
    }
    lastDragFramePointerRef.current = { x, y };

    scrollSyncRef.current = true;
    const scrolled = applyDragEdgeScroll(x, y, targets);
    if (scrolled && compactGrid) {
      syncFocusHeadTrack(scrollRef.current?.scrollLeft ?? 0);
    }
    scrollSyncRef.current = false;

    dragAutoScrollRafRef.current = requestAnimationFrame(runDragAutoScrollFrame);
  }, [compactGrid, getDragScrollTargets, syncFocusHeadTrack]);

  const ensureDragAutoScroll = useCallback(() => {
    if (dragAutoScrollRafRef.current != null) return;
    dragAutoScrollRafRef.current = requestAnimationFrame(runDragAutoScrollFrame);
  }, [runDragAutoScrollFrame]);

  const openConstructorForCells = useCallback(
    (roomIds: string[], dateStrs: string[]) => {
      modals.openRuleConstructor(
        buildRuleGridSelectionPreset(roomIds, dateStrs, activeRooms.length)
      );
    },
    [activeRooms.length, modals]
  );

  const onCellMouseDown = useCallback((roomId: string, dateStr: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = {
      active: true,
      anchorRoomId: roomId,
      anchorDateStr: dateStr,
      focusRoomId: roomId,
      focusDateStr: dateStr,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
    };
  }, []);

  const onCellMouseEnter = useCallback(
    (roomId: string, dateStr: string) => {
      const drag = dragRef.current;
      if (!drag.active) return;
      if (drag.focusRoomId === roomId && drag.focusDateStr === dateStr) return;

      drag.focusRoomId = roomId;
      drag.focusDateStr = dateStr;

      if (roomId !== drag.anchorRoomId || dateStr !== drag.anchorDateStr) {
        drag.moved = true;
      }

      if (drag.moved) {
        setDragHighlight(
          computeDragHighlight(drag.anchorRoomId, roomId, drag.anchorDateStr, dateStr)
        );
        ensureDragAutoScroll();
      }
    },
    [computeDragHighlight, ensureDragAutoScroll]
  );

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag.active) return;
    drag.active = false;
    stopDragAutoScroll();

    const highlight = computeDragHighlight(
      drag.anchorRoomId,
      drag.focusRoomId,
      drag.anchorDateStr,
      drag.focusDateStr
    );
    setDragHighlight(null);

    if (!highlight) return;

    openConstructorForCells(highlight.roomIds, highlight.dateStrs);
  }, [computeDragHighlight, openConstructorForCells, stopDragAutoScroll]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      const drag = dragRef.current;
      if (!drag.active) return;

      if (!drag.moved) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
          ensureDragAutoScroll();
          return;
        }
        drag.moved = true;
        setDragHighlight(
          computeDragHighlight(
            drag.anchorRoomId,
            drag.focusRoomId,
            drag.anchorDateStr,
            drag.focusDateStr
          )
        );
      }

      ensureDragAutoScroll();
    };

    const onMouseUp = () => finishDrag();

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      stopDragAutoScroll();
    };
  }, [finishDrag, computeDragHighlight, ensureDragAutoScroll, stopDragAutoScroll]);

  const sidebarHeader = (
    <TimelineSidebarHeader
      roomCount={activeRooms.length}
      className={compactGrid ? "" : "price-grid-sidebar-header"}
      showFocusToggle={!isMobile}
      focusModeActive={isFocusMode}
      onFocusToggle={toggleFocusMode}
      onUndoMove={() => adminUndo.undoLastInScope("restrictions")}
      canUndoMove={adminUndo.undoAvailable.restrictions}
      isUndoing={adminUndo.isUndoing}
    />
  );

  const roomRows = activeRooms.map((room) => (
    <TimelineRoomRow
      key={room.id}
      room={room}
      className="price-grid-room"
      showDesc={!isMobile && !compactGrid}
    />
  ));

  const monthRow = (
    <div className="timeline-months" id="restrictionMonths">
      <div className="timeline-month-cell" style={{ width: gridTotalWidth }}>
        {monthLabel}
      </div>
    </div>
  );

  const datesRow = (
    <div
      className={`timeline-dates${compactGrid ? "" : " price-grid-dates"}`}
      id="restrictionDates"
    >
      {dayMeta.map((day, i) => (
        <div
          key={day.dateStr}
          className={[
            "timeline-date",
            "price-grid-date",
            day.isWeekend ? "price-grid-date--weekend" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ width: columnWidths[i], minWidth: columnWidths[i], flexShrink: 0 }}
        >
          {day.date.getDate()} <span>{DAYS_LABELS[day.date.getDay()]}</span>
        </div>
      ))}
    </div>
  );

  const gridRows = (
    <div className="timeline-rows" id="restrictionGrid">
      {activeRooms.map((room) => (
        <div key={room.id} className="timeline-row-bg price-grid-row">
          {dayMeta.map((day, i) => {
            const { kind, minNights } = getRuleCellKind(settings, room.id, day.date);
            const selectionClasses = getCellSelectionClasses(
              dragHighlight,
              String(room.id),
              day.dateStr
            );

            return (
              <RuleGridCell
                key={day.dateStr}
                kind={kind}
                minNights={minNights}
                isWeekend={day.isWeekend}
                width={columnWidths[i]}
                dragSelectionClasses={selectionClasses}
                onDragMouseDown={(e) => onCellMouseDown(String(room.id), day.dateStr, e)}
                onDragMouseEnter={() => onCellMouseEnter(String(room.id), day.dateStr)}
                onOpenConstructor={() =>
                  openConstructorForCells([String(room.id)], [day.dateStr])
                }
              />
            );
          })}
        </div>
      ))}
    </div>
  );

  const wrapperClassName = [
    "timeline-wrapper",
    "price-grid-timeline",
    compactGrid
      ? "timeline-wrapper--compact timeline-wrapper--focus-layout price-grid-timeline--focus-root"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const premiumStyle: CSSProperties | undefined = compactGrid
    ? undefined
    : {
        ["--price-grid-month-h" as string]: `${PRICE_GRID_MONTH_HEIGHT}px`,
        ["--price-grid-dates-h" as string]: `${PRICE_GRID_DATES_HEIGHT}px`,
        ["--price-grid-header-h" as string]: `${PRICE_GRID_HEADER_HEIGHT}px`,
        ["--price-grid-row-h" as string]: `${PRICE_ROW_HEIGHT}px`,
      };

  return (
    <div className={`price-grid-view${compactGrid ? " price-grid-view--focus" : ""}`}>
      <div className={`price-grid-toolbar${isMobile ? " price-grid-toolbar--mobile" : ""}`}>
        <div className="price-grid-toolbar__nav">
          <div className="timeline-nav">
            <button type="button" className={`btn-icon${isMobile ? " tap-btn" : ""}`} onClick={() => shift(-1)}>
              <svg width={isMobile ? 14 : 16} height={isMobile ? 14 : 16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="timeline-month-label" id="restrictionMonthLabel">
              {monthLabel}
            </span>
            <button type="button" className={`btn-icon${isMobile ? " tap-btn" : ""}`} onClick={() => shift(1)}>
              <svg width={isMobile ? 14 : 16} height={isMobile ? 14 : 16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            className={`btn-secondary${isMobile ? " tap-btn" : ""}`}
            onClick={resetToToday}
          >
            Поточний місяць
          </button>
        </div>

        <div className="price-grid-toolbar__actions">
          <button
            type="button"
            className={`btn-outline-danger${isMobile ? " tap-btn" : ""}`}
            onClick={() => modals.clearRulesAlert()}
          >
            {isMobile ? "Очистити" : "Видалити правила"}
          </button>
          <button
            type="button"
            className={`btn-primary${isMobile ? " tap-btn" : ""}`}
            onClick={() => modals.openRuleConstructor()}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Конструктор
          </button>
        </div>
      </div>

      <div
        className={`price-grid-premium${compactGrid ? " price-grid-premium--focus" : ""}`}
        style={premiumStyle}
      >
        <div className={wrapperClassName} id="restrictionTimelineWrapper" style={{ marginTop: 0 }}>
          {compactGrid ? (
            <>
              <div className="timeline-focus-head">
                <div className="timeline-sidebar timeline-sidebar--focus-head">
                  {sidebarHeader}
                </div>
                <div className="timeline-grid-head">
                  <div className="timeline-head-track" ref={headTrackRef}>
                    {monthRow}
                    {datesRow}
                  </div>
                </div>
              </div>
              <div className="timeline-focus-body">
                <div
                  className="timeline-sidebar timeline-sidebar--focus-body"
                  ref={sidebarBodyScrollRef}
                  onScroll={handleSidebarBodyScroll}
                >
                  {roomRows}
                </div>
                <div
                  className="timeline-grid-container timeline-scroll-surface"
                  ref={scrollRef}
                  id="restrictionScroll"
                  onScroll={handleGridContainerScroll}
                  onWheel={handleGridWheel}
                >
                  {gridRows}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="timeline-sidebar price-grid-sidebar">
                {sidebarHeader}
                {roomRows}
              </div>
              <div className="timeline-grid-container" ref={scrollRef} id="restrictionScroll">
                {monthRow}
                {datesRow}
                {gridRows}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function scrollToRestrictionsGrid(
  wrapperRef?: RefObject<HTMLDivElement | null>
) {
  if (typeof window === "undefined") return;
  const target =
    wrapperRef?.current ?? document.getElementById("set-restrictions");
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}
