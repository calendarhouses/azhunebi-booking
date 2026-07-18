"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { formatDateKey } from "../bookingUtils";
import { useGridFocusModeOptional } from "../GridFocusModeContext";
import {
  applyDragEdgeScroll,
  isNearDragScrollEdge,
  type DragScrollTargets,
} from "../timelineDragAutoScroll";
import { TimelineSidebarHeader, TimelineRoomRow } from "../TimelineSidebarRooms";
import { isPriceWeekend } from "./restrictionGridUtils";
import {
  formatMonthYearLabel,
  formatPriceAmount,
  measurePriceCellWidth,
  measurePriceEditWidth,
  parsePriceInput,
  PRICE_CELL_MIN,
  PRICE_GRID_DATES_HEIGHT,
  PRICE_GRID_HEADER_HEIGHT,
  PRICE_GRID_MONTH_HEIGHT,
  PRICE_ROW_HEIGHT,
} from "./priceGridUtils";
import { buildGridSelectionPreset } from "./priceConstructorLogic";
import type { AdminModalsApi } from "../useAdminModals";
import type { AdminUndoApi } from "@/components/admin/undo/useAdminUndo";
import type { AdminSettingsPayload } from "../types";
import { BookingQuickEditDrawer } from "@/components/admin/mobile/BookingQuickEditDrawer";

const DAYS_LABELS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const DRAG_THRESHOLD_PX = 5;
const TOUCH_DRAG_THRESHOLD_PX = 10;
/** Touch must hold this long on a cell before multi-select starts (keeps pan/scroll free). */
const TOUCH_SELECT_HOLD_MS = 500;

function priceCellFromPoint(x: number, y: number): { roomId: string; dateStr: string } | null {
  if (typeof document === "undefined") return null;
  const el = document.elementFromPoint(x, y);
  const cell = el?.closest?.("[data-price-room][data-price-date]") as HTMLElement | null;
  if (!cell?.dataset.priceRoom || !cell.dataset.priceDate) return null;
  return { roomId: cell.dataset.priceRoom, dateStr: cell.dataset.priceDate };
}

type EditCell = { roomId: string; dateStr: string; selectAll?: boolean } | null;

type DragHighlight = { roomIds: string[]; dateStrs: string[] };

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

function PriceGridCell({
  roomId,
  dateStr,
  price,
  isWeekend,
  isCustom,
  width,
  editing,
  dragSelectionClasses: selectionClasses,
  selectAllOnFocus,
  onStartEdit,
  onDraftChange,
  onCommit,
  onCancel,
  onDragPointerDown,
  enableTouchPan,
}: {
  roomId: string;
  dateStr: string;
  price: number;
  isWeekend: boolean;
  isCustom: boolean;
  width: number;
  editing: boolean;
  dragSelectionClasses: string[];
  selectAllOnFocus: boolean;
  onStartEdit: (selectAll: boolean) => void;
  onDraftChange: (draft: string) => void;
  onCommit: (amount: number) => void;
  onCancel: () => void;
  onDragPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  enableTouchPan?: boolean;
}) {
  const [draft, setDraft] = useState(String(price));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      const next = String(price);
      setDraft(next);
      onDraftChange(next);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        if (selectAllOnFocus) {
          el.select();
        } else {
          const len = el.value.length;
          el.setSelectionRange(len, len);
        }
      });
    }
  }, [editing, price, selectAllOnFocus, onDraftChange]);

  const commit = () => {
    onCommit(parsePriceInput(draft));
  };

  const cellClass = [
    "price-cell",
    "timeline-cell",
    "flex shrink-0 items-center justify-center",
    "border-r border-stone-100",
    isWeekend ? "price-cell--weekend bg-[#fafaf9]" : "bg-white",
    !editing ? "cursor-pointer" : "",
    editing ? "price-cell--editing" : "",
    isCustom ? "price-cell--custom" : "",
    ...(editing ? [] : selectionClasses),
  ]
    .filter(Boolean)
    .join(" ");

  const cellStyle: CSSProperties = {
    width,
    minWidth: width,
    height: "100%",
    alignSelf: "stretch",
    // On mobile, pan until selection arms; scroll lock then blocks via touchmove preventDefault.
    touchAction: editing ? "auto" : enableTouchPan ? "pan-x pan-y" : "none",
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onStartEdit(true);
  };

  if (editing) {
    return (
      <div className={cellClass} style={cellStyle} data-price-room={roomId} data-price-date={dateStr}>
        <div className="price-cell-editor price-cell-editor--inline">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            className="price-cell-editor__input"
            value={draft}
            onChange={(e) => {
              const next = e.target.value.replace(/[^\d\s]/g, "");
              setDraft(next);
              onDraftChange(next);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
            onBlur={commit}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={cellClass}
      style={cellStyle}
      data-price-room={roomId}
      data-price-date={dateStr}
      onDoubleClick={handleDoubleClick}
      onPointerDown={onDragPointerDown}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onStartEdit(false);
        }
      }}
    >
      <div className="pointer-events-none flex h-full w-full items-center justify-center whitespace-nowrap px-2">
        <span className={`text-sm font-semibold ${isCustom ? "text-stone-800" : "text-stone-700"}`}>
          {formatPriceAmount(price)}
        </span>
        <span className="ml-1 shrink-0 text-xs text-stone-400">₴</span>
      </div>
    </div>
  );
}

export interface DesktopPriceGridProps {
  settings: AdminSettingsPayload;
  modals: AdminModalsApi;
  baseDateRef: React.MutableRefObject<Date>;
  layout?: "desktop" | "mobile";
  isTabActive?: boolean;
  adminUndo: AdminUndoApi;
}

export function DesktopPriceGrid({
  settings,
  modals,
  baseDateRef,
  layout = "desktop",
  isTabActive = true,
  adminUndo,
}: DesktopPriceGridProps) {
  const isMobile = layout === "mobile";
  const [, bump] = useState(0);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const mobileDense = isMobile && isFocusMode;
  /** Sticky head + body scroll is desktop-only; mobile keeps dates inside the same scroller. */
  const compactGrid = !isMobile && isFocusMode;
  const focusLayout = compactGrid;
  const { setAuxiliaryFocusActive } = useGridFocusModeOptional();
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headTrackRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const sidebarBodyScrollRef = useRef<HTMLDivElement>(null);
  const scrollSyncRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const lastDragFramePointerRef = useRef({ x: 0, y: 0 });
  const dragAutoScrollRafRef = useRef<number | null>(null);
  const touchSelectHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsMainRef = useRef<HTMLElement | null>(null);
  const [editCell, setEditCell] = useState<EditCell>(null);
  const [sheetEdit, setSheetEdit] = useState<{
    roomId: string;
    dateStr: string;
    value: number;
  } | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [dragHighlight, setDragHighlight] = useState<DragHighlight | null>(null);
  const dragRef = useRef<{
    active: boolean;
    pending: boolean;
    pointerId: number;
    pointerType: string;
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
  const customPrices = settings.customPrices || {};
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

  useEffect(() => {
    if (!isMobile) return;
    document.body.classList.toggle("boso-prices-dense", mobileDense);
    return () => {
      document.body.classList.remove("boso-prices-dense");
    };
  }, [isMobile, mobileDense]);

  const syncFocusHeadTrack = useCallback((scrollLeft: number) => {
    const track = headTrackRef.current;
    if (!track) return;
    track.style.transform = `translate3d(${-scrollLeft}px, 0, 0)`;
  }, []);

  const handleGridContainerScroll = useCallback(() => {
    if (scrollSyncRef.current) return;
    const grid = scrollRef.current;
    if (!grid) return;

    scrollSyncRef.current = true;
    if (focusLayout) {
      syncFocusHeadTrack(grid.scrollLeft);
    }
    const sidebar = sidebarBodyScrollRef.current;
    if (sidebar && sidebar.scrollTop !== grid.scrollTop) {
      sidebar.scrollTop = grid.scrollTop;
    }
    scrollSyncRef.current = false;
  }, [focusLayout, syncFocusHeadTrack]);

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
      if (!focusLayout) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const sidebar = sidebarBodyScrollRef.current;
      if (!sidebar) return;
      event.preventDefault();
      sidebar.scrollTop += event.deltaY;
    },
    [focusLayout]
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
      const roomPrices = customPrices[String(room.id)];
      dayMeta.forEach((day, i) => {
        let price = day.isWeekend ? room.priceWeekend : room.priceWeekday;
        if (roomPrices?.[day.dateStr] != null) price = roomPrices[day.dateStr];
        const priceStr = String(price);
        widths[i] = Math.max(
          widths[i],
          measurePriceCellWidth(price),
          measurePriceEditWidth(priceStr)
        );
      });
    }

    if (editCell) {
      const idx = dayMeta.findIndex((d) => d.dateStr === editCell.dateStr);
      if (idx >= 0) {
        widths[idx] = Math.max(widths[idx], measurePriceEditWidth(editDraft));
      }
    }

    return widths;
  }, [isMobile, activeRooms, customPrices, dayMeta, daysCount, editCell, editDraft]);

  columnWidthsRef.current = columnWidths;

  const gridTotalWidth = useMemo(
    () => columnWidths.reduce((sum, w) => sum + w, 0),
    [columnWidths]
  );

  const handleMobilePriceScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Only pull back if we overscrolled past the real board (phantom empty columns).
    const maxLeft = Math.max(0, gridTotalWidth + 88 - el.clientWidth);
    if (el.scrollLeft > maxLeft + 1) el.scrollLeft = maxLeft;
  }, [gridTotalWidth]);

  useEffect(() => {
    if (!isMobile) return;
    handleMobilePriceScroll();
  }, [isMobile, gridTotalWidth, activeRooms.length, mobileDense, handleMobilePriceScroll]);

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
      shiftPriceTimeline?: (months: number) => void;
      resetPriceTimelineToToday?: () => void;
      renderPriceGrid?: () => void;
    };
    w.shiftPriceTimeline = shift;
    w.resetPriceTimelineToToday = resetToToday;
    w.renderPriceGrid = () => bump((n) => n + 1);
    return () => {
      delete w.shiftPriceTimeline;
      delete w.resetPriceTimelineToToday;
      delete w.renderPriceGrid;
    };
  }, [shift, resetToToday]);

  useEffect(() => {
    settingsMainRef.current = document.querySelector(
      isMobile ? ".main-content" : ".main-content.main-content--settings"
    );
  }, [isMobile]);

  const getDragScrollTargets = useCallback((): DragScrollTargets => {
    if (isMobile || focusLayout) {
      return {
        horizontal: scrollRef.current,
        vertical: scrollRef.current,
        verticalSync: focusLayout ? sidebarBodyScrollRef.current : null,
      };
    }
    return {
      horizontal: scrollRef.current,
      verticalPage: settingsMainRef.current,
    };
  }, [focusLayout, isMobile]);

  const dragScrollOptions = useCallback(
    () => ({ viewportEdges: isMobile }),
    [isMobile]
  );

  useEffect(() => {
    if (isMobile) return;
    const active = isTabActive && isFocusMode;
    setAuxiliaryFocusActive(active);
    return () => {
      setAuxiliaryFocusActive(false);
    };
  }, [isFocusMode, isMobile, isTabActive, setAuxiliaryFocusActive]);

  useEffect(() => {
    if (!isTabActive && isFocusMode) {
      setIsFocusMode(false);
    }
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
      if (focusLayout) syncFocusHeadTrack(offset);
    } else {
      el.scrollLeft = 0;
      if (focusLayout) syncFocusHeadTrack(0);
    }
  }, [startDate, daysCount, focusLayout, syncFocusHeadTrack]);

  useLayoutEffect(() => {
    if (scrollPreserveRef.current == null) return;
    const el = scrollRef.current;
    if (!el) {
      scrollPreserveRef.current = null;
      return;
    }
    el.scrollLeft = scrollPreserveRef.current;
    scrollPreserveRef.current = null;
  }, [columnWidths, editCell]);

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
    if (scrolled && focusLayout) {
      syncFocusHeadTrack(scrollRef.current?.scrollLeft ?? 0);
    }
    scrollSyncRef.current = false;

    if (scrolled) {
      const hit = priceCellFromPoint(x, y);
      if (hit && hit.roomId === drag.anchorRoomId) {
        // keep selection within the anchor room row while edge-scrolling
      }
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
    focusLayout,
    getDragScrollTargets,
    dragScrollOptions,
    syncFocusHeadTrack,
    computeDragHighlight,
  ]);

  const ensureDragAutoScroll = useCallback(() => {
    if (dragAutoScrollRafRef.current != null) return;
    dragAutoScrollRafRef.current = requestAnimationFrame(runDragAutoScrollFrame);
  }, [runDragAutoScrollFrame]);

  const commitInlinePrice = useCallback(
    async (roomId: string, dateStr: string, amount: number) => {
      const key = `${roomId}:${dateStr}`;
      if (savingCell === key) return;
      setSavingCell(key);
      setEditCell(null);
      setEditDraft("");
      try {
        await modals.patchCustomPrice(roomId, dateStr, amount);
      } finally {
        setSavingCell(null);
      }
    },
    [modals, savingCell]
  );

  const handleDraftChange = useCallback((draft: string) => {
    setEditDraft(draft);
  }, []);

  const touchScrollLockRef = useRef<((e: TouchEvent) => void) | null>(null);

  const setTouchSelectingClass = useCallback((on: boolean) => {
    rootRef.current?.classList.toggle("price-grid-view--touch-selecting", on);
    if (on) {
      if (!touchScrollLockRef.current) {
        const lock = (e: TouchEvent) => {
          if (dragRef.current.active) e.preventDefault();
        };
        touchScrollLockRef.current = lock;
        document.addEventListener("touchmove", lock, { passive: false });
      }
    } else if (touchScrollLockRef.current) {
      document.removeEventListener("touchmove", touchScrollLockRef.current);
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
    drag.pending = false;
    drag.active = true;
    // DOM class first (no React re-render) so touch-action flips without cancelling the pointer.
    setTouchSelectingClass(true);
    if (drag.captureEl) {
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
  }, [computeDragHighlight, ensureDragAutoScroll, setTouchSelectingClass]);

  const onCellPointerDown = useCallback(
    (roomId: string, dateStr: string, e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;

      if (
        editCell &&
        (editCell.roomId !== roomId || editCell.dateStr !== dateStr)
      ) {
        void commitInlinePrice(
          editCell.roomId,
          editCell.dateStr,
          parsePriceInput(editDraft)
        );
      }

      clearTouchSelectHold();
      const isTouch = e.pointerType === "touch";
      lastPointerRef.current = { x: e.clientX, y: e.clientY };

      dragRef.current = {
        active: !isTouch,
        pending: isTouch,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        anchorRoomId: roomId,
        anchorDateStr: dateStr,
        focusRoomId: roomId,
        focusDateStr: dateStr,
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        captureEl: e.currentTarget,
      };

      if (!isTouch) {
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }

      touchSelectHoldTimerRef.current = setTimeout(() => {
        touchSelectHoldTimerRef.current = null;
        armTouchSelection();
      }, TOUCH_SELECT_HOLD_MS);
    },
    [editCell, editDraft, commitInlinePrice, clearTouchSelectHold, armTouchSelection]
  );

  const updateDragFocusFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag.active) return;
      const hit = priceCellFromPoint(clientX, clientY);
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

  const resolveCellPrice = useCallback(
    (roomId: string, dateStr: string) => {
      const room = activeRooms.find((r) => String(r.id) === roomId);
      const day = dayMeta.find((d) => d.dateStr === dateStr);
      let price = 0;
      if (room && day) {
        price = day.isWeekend ? room.priceWeekend : room.priceWeekday;
        const rp = customPrices[roomId];
        if (rp?.[dateStr] != null) price = rp[dateStr];
      }
      return price;
    },
    [activeRooms, dayMeta, customPrices]
  );

  const openInlineEdit = useCallback(
    (roomId: string, dateStr: string, selectAll = false) => {
      const price = resolveCellPrice(roomId, dateStr);
      setDragHighlight(null);

      if (isMobile) {
        setEditCell(null);
        setEditDraft("");
        setSheetEdit({ roomId, dateStr, value: price });
        return;
      }

      scrollPreserveRef.current = scrollRef.current?.scrollLeft ?? 0;
      setEditCell({ roomId, dateStr, selectAll });
      setEditDraft(String(price));
    },
    [isMobile, resolveCellPrice]
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
    const moved = drag.moved;
    resetDragSession();
    setDragHighlight(null);

    if (!highlight) return;

    const cellCount = highlight.roomIds.length * highlight.dateStrs.length;
    if (cellCount > 1 || moved) {
      setEditCell(null);
      setEditDraft("");
      modals.openPriceConstructor(
        buildGridSelectionPreset(highlight.roomIds, highlight.dateStrs, activeRooms.length)
      );
      return;
    }

    openInlineEdit(highlight.roomIds[0], highlight.dateStrs[0], false);
  }, [activeRooms.length, computeDragHighlight, modals, openInlineEdit, resetDragSession]);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      const drag = dragRef.current;
      if (drag.pointerId >= 0 && e.pointerId !== drag.pointerId) return;

      if (drag.pending) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.hypot(dx, dy) >= TOUCH_DRAG_THRESHOLD_PX) {
          abortDragSelection();
        }
        return;
      }

      if (!drag.active) return;

      if (!drag.moved) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        const threshold = e.pointerType === "touch" ? TOUCH_DRAG_THRESHOLD_PX : DRAG_THRESHOLD_PX;
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
          openInlineEdit(anchorRoomId, anchorDateStr, false);
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
      // Cancel = browser aborted the gesture; do not open constructor/editor.
      if (drag.pending || drag.active) {
        abortDragSelection();
      }
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerCancel);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerCancel);
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
    openInlineEdit,
    clearTouchSelectHold,
  ]);

  const sidebarHeader = (
    <TimelineSidebarHeader
      roomCount={activeRooms.length}
      className={compactGrid ? "" : "price-grid-sidebar-header"}
      showFocusToggle={!isMobile}
      focusModeActive={isFocusMode}
      onFocusToggle={toggleFocusMode}
      onUndoMove={() => adminUndo.undoLastInScope("prices")}
      canUndoMove={adminUndo.undoAvailable.prices}
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
    <div className="timeline-months" id="priceMonths">
      <div className="timeline-month-cell" style={{ width: "100%" }}>
        {monthLabel}
      </div>
    </div>
  );

  const datesRow = (
    <div
      className={`timeline-dates${compactGrid ? "" : " price-grid-dates"}`}
      id="priceDates"
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
    <div className="timeline-rows" id="priceGrid">
      {activeRooms.map((room) => (
        <div key={room.id} className="timeline-row-bg price-grid-row">
          {dayMeta.map((day, i) => {
            const roomPrices = customPrices[String(room.id)];
            const isCustom = roomPrices?.[day.dateStr] != null;
            let price = day.isWeekend ? room.priceWeekend : room.priceWeekday;
            if (roomPrices?.[day.dateStr] != null) {
              price = roomPrices[day.dateStr];
            }
            const editing =
              editCell?.roomId === String(room.id) && editCell.dateStr === day.dateStr;
            const selectionClasses = getCellSelectionClasses(
              dragHighlight,
              String(room.id),
              day.dateStr
            );

            return (
              <PriceGridCell
                key={day.dateStr}
                roomId={String(room.id)}
                dateStr={day.dateStr}
                price={price}
                isWeekend={day.isWeekend}
                isCustom={isCustom}
                width={columnWidths[i]}
                editing={editing}
                dragSelectionClasses={selectionClasses}
                selectAllOnFocus={Boolean(editing && editCell?.selectAll)}
                onStartEdit={(selectAll) => {
                  if (dragRef.current.active || dragRef.current.pending) return;
                  openInlineEdit(String(room.id), day.dateStr, selectAll);
                }}
                onDraftChange={handleDraftChange}
                onCommit={(amount) => {
                  if (
                    editCell?.roomId !== String(room.id) ||
                    editCell?.dateStr !== day.dateStr
                  ) {
                    return;
                  }
                  void commitInlinePrice(String(room.id), day.dateStr, amount);
                }}
                onCancel={() => {
                  setEditCell(null);
                  setEditDraft("");
                }}
                onDragPointerDown={(e) => onCellPointerDown(String(room.id), day.dateStr, e)}
                enableTouchPan={isMobile}
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
    focusLayout
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
        focusLayout ? "price-grid-view--focus" : "",
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
                <span className="timeline-month-label" id="priceMonthLabel">
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
                className="btn-outline-danger tap-btn"
                onClick={() => modals.clearPricesAlert()}
              >
                Очистити
              </button>
              <button
                type="button"
                className="btn-primary tap-btn"
                onClick={() => modals.openPriceConstructor()}
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
                <span className="timeline-month-label" id="priceMonthLabel">
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
                onClick={() => modals.clearPricesAlert()}
              >
                Видалити ціни
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => modals.openPriceConstructor()}
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
        className={`price-grid-premium${focusLayout ? " price-grid-premium--focus" : ""}${isMobile ? " price-grid-premium--mobile" : ""}${mobileDense ? " price-grid-premium--mobile-dense" : ""}`}
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
            id="priceTimelineWrapper"
            style={
              {
                marginTop: 0,
                width: "100%",
                maxWidth: "100%",
                minWidth: 0,
                flex: "0 0 auto",
                ["--timeline-cell-width" as string]: `${PRICE_CELL_MIN}px`,
                ["--timeline-grid-width" as string]: `${gridTotalWidth}px`,
              } as CSSProperties
            }
          >
            <div
              className="timeline-mobile-scroll timeline-scroll-surface"
              id="priceScroll"
              ref={scrollRef}
              onScroll={handleMobilePriceScroll}
              style={{
                width: "100%",
                maxWidth: "100%",
                minWidth: 0,
                flex: "0 0 auto",
                maxHeight: "calc(100dvh - 210px)",
                overflow: "auto",
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-x pan-y",
                overscrollBehavior: "contain",
              }}
            >
              <div
                className="timeline-mobile-board"
                style={{
                  width: gridTotalWidth + 88,
                  minWidth: gridTotalWidth + 88,
                  maxWidth: gridTotalWidth + 88,
                  minHeight: 0,
                  overflow: "hidden",
                  boxSizing: "border-box",
                }}
              >
                <div className="timeline-mobile-head">
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
                </div>
                <div
                  className="timeline-mobile-body"
                  style={{
                    width: gridTotalWidth + 88,
                    minWidth: gridTotalWidth + 88,
                    maxWidth: gridTotalWidth + 88,
                  }}
                >
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
          </div>
        ) : (
          <div
            className={wrapperClassName}
            id="priceTimelineWrapper"
            style={{ marginTop: 0 }}
          >
            {focusLayout ? (
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
                    id="priceScroll"
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
                <div className="timeline-grid-container" ref={scrollRef} id="priceScroll">
                  <div
                    className="price-grid-track"
                    style={{
                      width: gridTotalWidth,
                      minWidth: gridTotalWidth,
                      maxWidth: gridTotalWidth,
                    }}
                  >
                    {monthRow}
                    {datesRow}
                    {gridRows}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {isMobile ? (
        <BookingQuickEditDrawer
          open={Boolean(sheetEdit)}
          title={
            sheetEdit
              ? `Ціна · ${sheetEdit.dateStr.slice(8, 10)}.${sheetEdit.dateStr.slice(5, 7)}`
              : "Ціна за ніч"
          }
          value={sheetEdit?.value ?? 0}
          defaultValue={sheetEdit?.value ?? 0}
          onClose={() => setSheetEdit(null)}
          onSave={(amount) => {
            if (!sheetEdit) return;
            const { roomId, dateStr } = sheetEdit;
            setSheetEdit(null);
            void commitInlinePrice(roomId, dateStr, amount);
          }}
        />
      ) : null}
    </div>
  );
}
