"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type WheelEvent,
} from "react";
import { Maximize2, Minimize2, Trash2, Undo2 } from "lucide-react";
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
import { isAndroidUserAgent } from "@/lib/isMobileUserAgent";
import {
  canArmTouchGesture,
  changedTouchMatches,
  ensureChessboardTouchTracking,
  bindTouchIdWhenReady,
  shouldSoftKeepAfterPointerCancel,
  touchFromList,
} from "@/lib/chessboardTouchSession";

const DAYS_LABELS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const DRAG_THRESHOLD_PX = 5;
const TOUCH_DRAG_THRESHOLD_PX = 10;
/** Cancel long-press as soon as the finger clearly moves (page scroll / pan). */
const TOUCH_HOLD_CANCEL_PX = 6;
/** Touch must hold this long on a cell before multi-select starts (keeps pan/scroll free). */
const TOUCH_SELECT_HOLD_MS = 500;
const TOUCH_SELECT_HOLD_MS_ANDROID = 520;

function ruleCellFromPoint(x: number, y: number): { roomId: string; dateStr: string } | null {
  if (typeof document === "undefined") return null;
  const el = document.elementFromPoint(x, y);
  const cell = el?.closest?.("[data-rule-room][data-rule-date]") as HTMLElement | null;
  if (!cell?.dataset.ruleRoom || !cell.dataset.ruleDate) return null;
  return { roomId: cell.dataset.ruleRoom, dateStr: cell.dataset.ruleDate };
}

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
  roomId,
  dateStr,
  kind,
  minNights,
  isWeekend,
  width,
  dragSelectionClasses: selectionClasses,
  onDragPointerDown,
  onOpenConstructor,
  enableTouchPan,
}: {
  roomId: string;
  dateStr: string;
  kind: RuleCellKind;
  minNights: number;
  isWeekend: boolean;
  width: number;
  dragSelectionClasses: string[];
  onDragPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onOpenConstructor: () => void;
  enableTouchPan?: boolean;
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

  const cellStyle: CSSProperties = {
    width,
    minWidth: width,
    height: "100%",
    alignSelf: "stretch",
    // Horizontal-only scrollport: pan-x lets Android chain vertical swipes to the page.
    touchAction: enableTouchPan ? "pan-x" : "none",
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cellClass}
      style={cellStyle}
      data-rule-room={roomId}
      data-rule-date={dateStr}
      onDoubleClick={(e) => {
        e.preventDefault();
        onOpenConstructor();
      }}
      onPointerDown={onDragPointerDown}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenConstructor();
        }
      }}
    >
      <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center whitespace-nowrap px-2">
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
  const isAndroid = useMemo(
    () => (typeof navigator !== "undefined" ? isAndroidUserAgent(navigator.userAgent) : false),
    []
  );
  const [, bump] = useState(0);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const mobileDense = isMobile && isFocusMode;
  /** Sticky head + body scroll is desktop-only; mobile keeps dates inside the same scroller. */
  const compactGrid = !isMobile && isFocusMode;
  const { setAuxiliaryFocusActive } = useGridFocusModeOptional();
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headTrackRef = useRef<HTMLDivElement>(null);
  const sidebarBodyScrollRef = useRef<HTMLDivElement>(null);
  const scrollSyncRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const lastDragFramePointerRef = useRef({ x: 0, y: 0 });
  const dragAutoScrollRafRef = useRef<number | null>(null);
  const touchSelectHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchScrollLockRef = useRef<((e: TouchEvent) => void) | null>(null);
  const settingsMainRef = useRef<HTMLElement | null>(null);
  const [dragHighlight, setDragHighlight] = useState<DragHighlight | null>(null);
  const dragRef = useRef<{
    active: boolean;
    pending: boolean;
    pointerId: number;
    pointerType: string;
    touchId: number | null;
    anchorRoomId: string;
    anchorDateStr: string;
    focusRoomId: string;
    focusDateStr: string;
    moved: boolean;
    startX: number;
    startY: number;
    captureEl: HTMLElement | null;
  }>({
    active: false,
    pending: false,
    pointerId: -1,
    pointerType: "",
    touchId: null,
    anchorRoomId: "",
    anchorDateStr: "",
    focusRoomId: "",
    focusDateStr: "",
    moved: false,
    startX: 0,
    startY: 0,
    captureEl: null,
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
    // Mobile: fixed day columns — avoids measured widths drifting past the dates header.
    if (isMobile) {
      return Array.from({ length: daysCount }, () => PRICE_CELL_MIN);
    }

    const widths = Array.from({ length: daysCount }, () => PRICE_CELL_MIN);

    for (const room of activeRooms) {
      dayMeta.forEach((day, i) => {
        const { kind, minNights } = getRuleCellKind(settings, room.id, day.date);
        widths[i] = Math.max(widths[i], measureRuleCellWidth(kind, minNights));
      });
    }

    return widths;
  }, [isMobile, activeRooms, dayMeta, daysCount, settings]);

  columnWidthsRef.current = columnWidths;

  const gridTotalWidth = useMemo(
    () => columnWidths.reduce((sum, w) => sum + w, 0),
    [columnWidths]
  );

  const handleMobileRestrictionScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Only pull back if we overscrolled past the real board (phantom empty columns).
    const maxLeft = Math.max(0, gridTotalWidth + 88 - el.clientWidth);
    if (el.scrollLeft > maxLeft + 1) el.scrollLeft = maxLeft;
  }, [gridTotalWidth]);

  useEffect(() => {
    if (!isMobile) return;
    handleMobileRestrictionScroll();
  }, [isMobile, gridTotalWidth, activeRooms.length, mobileDense, handleMobileRestrictionScroll]);

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
    settingsMainRef.current = document.querySelector(
      isMobile ? ".main-content" : ".main-content.main-content--settings"
    );
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
    if (isMobile || compactGrid) {
      return {
        horizontal: scrollRef.current,
        vertical: scrollRef.current,
        verticalSync: compactGrid ? sidebarBodyScrollRef.current : null,
      };
    }
    return {
      horizontal: scrollRef.current,
      verticalPage: settingsMainRef.current,
    };
  }, [compactGrid, isMobile]);

  const dragScrollOptions = useCallback(
    () => ({ viewportEdges: isMobile }),
    [isMobile]
  );

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
    const opts = dragScrollOptions();
    const { x, y } = lastPointerRef.current;
    const nearEdge = isNearDragScrollEdge(x, y, targets, opts);
    const moved =
      x !== lastDragFramePointerRef.current.x || y !== lastDragFramePointerRef.current.y;

    if (!moved && !nearEdge) {
      dragAutoScrollRafRef.current = null;
      return;
    }
    lastDragFramePointerRef.current = { x, y };

    scrollSyncRef.current = true;
    const scrolled = applyDragEdgeScroll(x, y, targets, opts);
    if (scrolled && compactGrid) {
      syncFocusHeadTrack(scrollRef.current?.scrollLeft ?? 0);
    }
    scrollSyncRef.current = false;

    if (scrolled) {
      const hit = ruleCellFromPoint(x, y);
      if (hit) {
        drag.focusRoomId = hit.roomId;
        drag.focusDateStr = hit.dateStr;
        if (hit.roomId !== drag.anchorRoomId || hit.dateStr !== drag.anchorDateStr) {
          drag.moved = true;
        }
        setDragHighlight(
          computeDragHighlight(drag.anchorRoomId, hit.roomId, drag.anchorDateStr, hit.dateStr)
        );
      }
    }

    dragAutoScrollRafRef.current = requestAnimationFrame(runDragAutoScrollFrame);
  }, [
    compactGrid,
    getDragScrollTargets,
    dragScrollOptions,
    syncFocusHeadTrack,
    computeDragHighlight,
  ]);

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

  const setTouchSelectingClass = useCallback((on: boolean) => {
    rootRef.current?.classList.toggle("price-grid-view--touch-selecting", on);
    const scroll = rootRef.current?.querySelector(
      ".timeline-mobile-scroll, .timeline-scroll-surface, #restrictionScroll"
    ) as HTMLElement | null;
    scroll?.classList.toggle("timeline-mobile-scroll--gesture-lock", on);
    if (on) {
      if (!touchScrollLockRef.current) {
        const lock = (e: TouchEvent) => {
          if (dragRef.current.active && e.cancelable) e.preventDefault();
        };
        touchScrollLockRef.current = lock;
        document.addEventListener("touchmove", lock, { passive: false, capture: true });
      }
    } else if (touchScrollLockRef.current) {
      document.removeEventListener("touchmove", touchScrollLockRef.current, true);
      touchScrollLockRef.current = null;
    }
  }, []);

  const clearTouchSelectHold = useCallback(() => {
    if (touchSelectHoldTimerRef.current) {
      clearTimeout(touchSelectHoldTimerRef.current);
      touchSelectHoldTimerRef.current = null;
    }
  }, []);

  const resetDragSession = useCallback(() => {
    clearTouchSelectHold();
    setTouchSelectingClass(false);
    dragRef.current = {
      active: false,
      pending: false,
      pointerId: -1,
      pointerType: "",
      touchId: null,
      anchorRoomId: "",
      anchorDateStr: "",
      focusRoomId: "",
      focusDateStr: "",
      moved: false,
      startX: 0,
      startY: 0,
      captureEl: null,
    };
    stopDragAutoScroll();
  }, [clearTouchSelectHold, setTouchSelectingClass, stopDragAutoScroll]);

  const abortDragSelection = useCallback(() => {
    resetDragSession();
    setDragHighlight(null);
  }, [resetDragSession]);

  const armTouchSelection = useCallback(() => {
    const drag = dragRef.current;
    if (!drag.pending) return;
    const dx = lastPointerRef.current.x - drag.startX;
    const dy = lastPointerRef.current.y - drag.startY;
    if (Math.hypot(dx, dy) >= TOUCH_HOLD_CANCEL_PX) {
      abortDragSelection();
      return;
    }
    if (!canArmTouchGesture(drag.touchId, true)) {
      abortDragSelection();
      return;
    }
    drag.pending = false;
    drag.active = true;
    setTouchSelectingClass(true);
    if (!isAndroid && drag.captureEl) {
      try {
        drag.captureEl.setPointerCapture(drag.pointerId);
      } catch {
        /* ignore */
      }
    }
    setDragHighlight(
      computeDragHighlight(
        drag.anchorRoomId,
        drag.focusRoomId,
        drag.anchorDateStr,
        drag.focusDateStr
      )
    );
    ensureDragAutoScroll();
  }, [
    abortDragSelection,
    computeDragHighlight,
    ensureDragAutoScroll,
    setTouchSelectingClass,
    isAndroid,
  ]);

  const onCellPointerDown = useCallback(
    (roomId: string, dateStr: string, e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;

      clearTouchSelectHold();
      ensureChessboardTouchTracking();
      const isTouch = e.pointerType !== "mouse";
      lastPointerRef.current = { x: e.clientX, y: e.clientY };

      dragRef.current = {
        active: !isTouch,
        pending: isTouch,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        touchId: null,
        anchorRoomId: roomId,
        anchorDateStr: dateStr,
        focusRoomId: roomId,
        focusDateStr: dateStr,
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        captureEl: e.currentTarget,
      };

      if (isTouch) {
        bindTouchIdWhenReady(e.clientX, e.clientY, (id) => {
          const drag = dragRef.current;
          if (drag.pointerId !== e.pointerId) return;
          drag.touchId = id;
        });
      }

      if (!isTouch) {
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }

      const holdMs = isAndroid ? TOUCH_SELECT_HOLD_MS_ANDROID : TOUCH_SELECT_HOLD_MS;
      touchSelectHoldTimerRef.current = setTimeout(() => {
        touchSelectHoldTimerRef.current = null;
        armTouchSelection();
      }, holdMs);
    },
    [clearTouchSelectHold, armTouchSelection, isAndroid]
  );

  const updateDragFocusFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag.active) return;
      const hit = ruleCellFromPoint(clientX, clientY);
      if (!hit) return;
      if (drag.focusRoomId === hit.roomId && drag.focusDateStr === hit.dateStr) return;

      drag.focusRoomId = hit.roomId;
      drag.focusDateStr = hit.dateStr;
      if (hit.roomId !== drag.anchorRoomId || hit.dateStr !== drag.anchorDateStr) {
        drag.moved = true;
      }
      if (drag.moved) {
        setDragHighlight(
          computeDragHighlight(drag.anchorRoomId, hit.roomId, drag.anchorDateStr, hit.dateStr)
        );
        ensureDragAutoScroll();
      }
    },
    [computeDragHighlight, ensureDragAutoScroll]
  );

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag.active) {
      resetDragSession();
      return;
    }
    const highlight = computeDragHighlight(
      drag.anchorRoomId,
      drag.focusRoomId,
      drag.anchorDateStr,
      drag.focusDateStr
    );
    resetDragSession();
    setDragHighlight(null);

    if (!highlight) return;

    // Always open rule constructor (no inline edit) — single tap or multi-select.
    openConstructorForCells(highlight.roomIds, highlight.dateStrs);
  }, [computeDragHighlight, openConstructorForCells, resetDragSession]);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      const drag = dragRef.current;
      if (drag.pointerId >= 0 && e.pointerId !== drag.pointerId) return;

      if (drag.pending) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        const dist = Math.hypot(dx, dy);
        if (dist >= TOUCH_HOLD_CANCEL_PX && Math.abs(dy) >= Math.abs(dx)) {
          abortDragSelection();
          return;
        }
        if (dist >= TOUCH_DRAG_THRESHOLD_PX) {
          abortDragSelection();
        }
        return;
      }

      if (!drag.active) return;
      if (e.cancelable) e.preventDefault();

      if (!drag.moved) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        const threshold = drag.pointerType !== "mouse" ? TOUCH_DRAG_THRESHOLD_PX : DRAG_THRESHOLD_PX;
        if (Math.hypot(dx, dy) < threshold) {
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

      updateDragFocusFromPoint(e.clientX, e.clientY);
      ensureDragAutoScroll();
    };

    const onPointerUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (drag.pointerId >= 0 && e.pointerId !== drag.pointerId) return;

      if (drag.pending) {
        const { anchorRoomId, anchorDateStr } = drag;
        resetDragSession();
        if (anchorRoomId && anchorDateStr) {
          openConstructorForCells([anchorRoomId], [anchorDateStr]);
        }
        return;
      }

      if (!drag.active) return;
      // Only commit selection when the finger/mouse is released.
      finishDrag();
    };

    const onPointerCancel = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (drag.pointerId >= 0 && e.pointerId !== drag.pointerId) return;
      if (shouldSoftKeepAfterPointerCancel(drag.touchId)) return;
      if (drag.pending || drag.active) {
        abortDragSelection();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag.active && !drag.pending) return;
      const t = touchFromList(e.touches, drag.touchId);
      if (!t) return;

      if (drag.pending) {
        const dx = t.clientX - drag.startX;
        const dy = t.clientY - drag.startY;
        const dist = Math.hypot(dx, dy);
        lastPointerRef.current = { x: t.clientX, y: t.clientY };
        if (dist >= TOUCH_HOLD_CANCEL_PX && Math.abs(dy) >= Math.abs(dx)) {
          abortDragSelection();
          return;
        }
        if (dist >= TOUCH_DRAG_THRESHOLD_PX) {
          abortDragSelection();
        }
        return;
      }

      if (e.cancelable) e.preventDefault();
      lastPointerRef.current = { x: t.clientX, y: t.clientY };

      if (!drag.moved) {
        const dx = t.clientX - drag.startX;
        const dy = t.clientY - drag.startY;
        if (Math.hypot(dx, dy) < TOUCH_DRAG_THRESHOLD_PX) {
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

      updateDragFocusFromPoint(t.clientX, t.clientY);
      ensureDragAutoScroll();
    };

    const onTouchEnd = (e: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag.active && !drag.pending) return;
      if (!changedTouchMatches(e, drag.touchId)) return;
      if (drag.pending) {
        const { anchorRoomId, anchorDateStr } = drag;
        resetDragSession();
        if (anchorRoomId && anchorDateStr) {
          openConstructorForCells([anchorRoomId], [anchorDateStr]);
        }
        return;
      }
      finishDrag();
    };

    const onTouchCancel = (e: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag.active && !drag.pending) return;
      if (!changedTouchMatches(e, drag.touchId)) return;
      abortDragSelection();
    };

    document.addEventListener("pointermove", onPointerMove, { passive: false });
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerCancel);
    document.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchCancel);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerCancel);
      document.removeEventListener("touchmove", onTouchMove, true);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
      clearTouchSelectHold();
      stopDragAutoScroll();
    };
  }, [
    finishDrag,
    computeDragHighlight,
    ensureDragAutoScroll,
    stopDragAutoScroll,
    updateDragFocusFromPoint,
    resetDragSession,
    abortDragSelection,
    openConstructorForCells,
    clearTouchSelectHold,
  ]);

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
      <div className="timeline-month-cell" style={{ width: isMobile ? "100%" : gridTotalWidth }}>
        <span className="timeline-month-cell__label">{monthLabel}</span>
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
                roomId={String(room.id)}
                dateStr={day.dateStr}
                kind={kind}
                minNights={minNights}
                isWeekend={day.isWeekend}
                width={columnWidths[i]}
                dragSelectionClasses={selectionClasses}
                onDragPointerDown={(e) => onCellPointerDown(String(room.id), day.dateStr, e)}
                enableTouchPan={isMobile}
                onOpenConstructor={() => {
                  if (dragRef.current.active || dragRef.current.pending) return;
                  openConstructorForCells([String(room.id)], [day.dateStr]);
                }}
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

  const premiumStyle: CSSProperties | undefined = {
    ["--timeline-grid-width" as string]: `${gridTotalWidth}px`,
    ...(isMobile
      ? {
          flex: "0 0 auto",
          minWidth: 0,
          width: "100%",
          maxWidth: "100%",
          display: "flex",
          flexDirection: "column" as const,
          overflow: "hidden",
        }
      : {}),
    ...(compactGrid
      ? {}
      : mobileDense
        ? {
            ["--price-grid-month-h" as string]: "22px",
            ["--price-grid-dates-h" as string]: "32px",
            ["--price-grid-header-h" as string]: "54px",
            ["--price-grid-row-h" as string]: "34px",
            ["--timeline-room-height" as string]: "34px",
            ["--timeline-row-height" as string]: "34px",
            ["--timeline-sidebar-header-height" as string]: "54px",
            ["--timeline-months-height" as string]: "22px",
            ["--timeline-dates-height" as string]: "32px",
          }
        : {
            ["--price-grid-month-h" as string]: `${PRICE_GRID_MONTH_HEIGHT}px`,
            ["--price-grid-dates-h" as string]: `${PRICE_GRID_DATES_HEIGHT}px`,
            ["--price-grid-header-h" as string]: `${PRICE_GRID_HEADER_HEIGHT}px`,
            ["--price-grid-row-h" as string]: `${PRICE_ROW_HEIGHT}px`,
          }),
  };

  return (
    <div
      ref={rootRef}
      className={[
        "price-grid-view",
        compactGrid ? "price-grid-view--focus" : "",
        mobileDense ? "price-grid-view--mobile-dense" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        isMobile
          ? {
              display: "flex",
              flexDirection: "column",
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              flex: "0 0 auto",
            }
          : undefined
      }
    >
      <div
        className={`price-grid-toolbar${isMobile ? " price-grid-toolbar--mobile" : ""}${mobileDense ? " timeline-toolbar--dense-focus" : ""}`}
      >
        {isMobile ? (
          <>
            <div className="price-grid-toolbar__nav-row" aria-hidden={mobileDense || undefined}>
              <div className="timeline-nav">
                <button
                  type="button"
                  className="btn-icon price-month-nav-btn"
                  onClick={() => shift(-1)}
                  aria-label="Попередній місяць"
                  style={{ width: 28, height: 28, minWidth: 28, minHeight: 28, padding: 0 }}
                >
                  <svg width={12} height={12} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="timeline-month-label" id="restrictionMonthLabel">
                  {monthLabel}
                </span>
                <button
                  type="button"
                  className="btn-icon price-month-nav-btn"
                  onClick={() => shift(1)}
                  aria-label="Наступний місяць"
                  style={{ width: 28, height: 28, minWidth: 28, minHeight: 28, padding: 0 }}
                >
                  <svg width={12} height={12} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <button type="button" className="btn-secondary tap-btn" onClick={resetToToday}>
                Поточний місяць
              </button>
            </div>
            <div className="price-grid-toolbar__actions-row timeline-toolbar-actions">
              <button
                type="button"
                className={`timeline-undo-btn timeline-undo-btn--toolbar tap-btn${adminUndo.isUndoing ? " timeline-undo-btn--busy" : ""}`}
                onClick={() => adminUndo.undoLastInScope("restrictions")}
                disabled={!adminUndo.undoAvailable.restrictions || adminUndo.isUndoing}
                aria-label="Скасувати останню дію"
                aria-busy={adminUndo.isUndoing}
                title={
                  adminUndo.undoAvailable.restrictions
                    ? "Скасувати останню дію"
                    : "Немає дій для скасування"
                }
              >
                <Undo2 className="timeline-undo-btn__icon" strokeWidth={2} aria-hidden />
              </button>
              <button
                type="button"
                className="btn-outline-danger btn-icon-only price-grid-toolbar__clear-btn tap-btn"
                onClick={() => modals.clearRulesAlert()}
                aria-label="Очистити правила"
                title="Очистити"
              >
                <Trash2 size={18} strokeWidth={2} aria-hidden />
              </button>
              <button
                type="button"
                className="btn-primary tap-btn"
                onClick={() => modals.openRuleConstructor()}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Конструктор
              </button>
              <button
                type="button"
                className={`timeline-focus-toggle timeline-focus-toggle--toolbar tap-btn${mobileDense ? " is-active" : ""}`}
                onClick={toggleFocusMode}
                aria-pressed={mobileDense}
                aria-label={mobileDense ? "Звичайний розмір шахматки" : "Розгорнути шахматку"}
                title={mobileDense ? "Звичайний розмір" : "Розгорнути шахматку"}
              >
                {mobileDense ? (
                  <Minimize2 className="timeline-focus-toggle__icon" strokeWidth={2} aria-hidden />
                ) : (
                  <Maximize2 className="timeline-focus-toggle__icon" strokeWidth={2} aria-hidden />
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="price-grid-toolbar__nav">
              <div className="timeline-nav">
                <button type="button" className="btn-icon" onClick={() => shift(-1)}>
                  <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="timeline-month-label" id="restrictionMonthLabel">
                  {monthLabel}
                </span>
                <button type="button" className="btn-icon" onClick={() => shift(1)}>
                  <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <button type="button" className="btn-secondary" onClick={resetToToday}>
                Поточний місяць
              </button>
            </div>

            <div className="price-grid-toolbar__actions">
              <button
                type="button"
                className="btn-outline-danger"
                onClick={() => modals.clearRulesAlert()}
              >
                Видалити правила
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => modals.openRuleConstructor()}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Конструктор
              </button>
            </div>
          </>
        )}
      </div>

      <div
        className={`price-grid-premium${compactGrid ? " price-grid-premium--focus" : ""}${isMobile ? " price-grid-premium--mobile" : ""}${mobileDense ? " price-grid-premium--mobile-dense" : ""}`}
        style={premiumStyle}
      >
        {isMobile ? (
          <div
            className={[
              "timeline-wrapper",
              "price-grid-timeline",
              "timeline-wrapper--mobile-board",
              "price-grid-timeline--mobile-board",
              mobileDense ? "timeline-wrapper--mobile-dense price-grid-timeline--mobile-dense" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            id="restrictionTimelineWrapper"
            style={
              {
                marginTop: 0,
                width: "100%",
                maxWidth: "100%",
                minWidth: 0,
                flex: "0 0 auto",
                ["--timeline-cell-width" as string]: `${PRICE_CELL_MIN}px`,
                ["--timeline-grid-width" as string]: `${gridTotalWidth}px`,
                ["--timeline-mobile-head-height" as string]: mobileDense ? "54px" : "56px",
              } as CSSProperties
            }
          >
            <div
              className="timeline-mobile-scroll timeline-scroll-surface"
              id="restrictionScroll"
              ref={scrollRef}
              onScroll={handleMobileRestrictionScroll}
              style={{
                width: "100%",
                maxWidth: "100%",
                minWidth: 0,
                flex: "0 0 auto",
                overflowX: "auto",
                overflowY: "hidden",
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-x",
                overscrollBehaviorX: "none",
              }}
            >
              <div
                className="timeline-mobile-board"
                style={{
                  width: gridTotalWidth + 88,
                  minWidth: gridTotalWidth + 88,
                  maxWidth: gridTotalWidth + 88,
                  minHeight: 0,
                  overflow: "visible",
                  boxSizing: "border-box",
                }}
              >
                <div className="timeline-mobile-corner">{sidebarHeader}</div>
                <div
                  className="timeline-mobile-dates"
                  style={{
                    width: gridTotalWidth,
                    minWidth: gridTotalWidth,
                    maxWidth: gridTotalWidth,
                  }}
                >
                  {monthRow}
                  {datesRow}
                </div>
                <div className="timeline-mobile-rooms">{roomRows}</div>
                <div
                  className="timeline-mobile-cells"
                  style={{
                    width: gridTotalWidth,
                    minWidth: gridTotalWidth,
                    maxWidth: gridTotalWidth,
                  }}
                >
                  {gridRows}
                </div>
              </div>
            </div>
          </div>
        ) : (
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
        )}
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
