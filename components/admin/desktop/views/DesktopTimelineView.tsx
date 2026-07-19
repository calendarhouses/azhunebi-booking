"use client";

import { Infinity as InfinityIcon, Maximize2, Minimize2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { parseSafeDate } from "../adminDates";
import { bosoHover, bosoLeave } from "../adminTooltip";
import { useGridFocusModeOptional } from "../GridFocusModeContext";
import { TimelineSidebarHeader, TimelineRoomRow } from "../TimelineSidebarRooms";
import { TimelineGridRow } from "../TimelineGridCells";
import {
  bookingHasEarlyLate,
  displayClientName,
  findRoomForBooking,
  formatDateKey,
  formatTimelineFinText,
  formatTimelineGuestChip,
  getTimelineFinBadge,
  getTimelineStatusClass,
} from "../bookingUtils";
import {
  shiftDateKey,
  HOLDING_ROOM,
  isHoldingRoom,
  BOOKING_MOVE_THRESHOLD,
  bookingMoveKey,
  resolveActiveRoomIndex,
  resolveTargetRoomIndex,
  getTimelineRowHeight,
  type BookingMoveSession,
} from "../timelineBookingMove";
import { isAndroidUserAgent } from "@/lib/isMobileUserAgent";
import {
  buildTimelineConstraintsByRoom,
  buildRoomTimelineConstraints,
  clampSelectionWithAnchor,
  resolveHoverPreviewRange,
  resolveSelectionNightFromPointer,
  resolveSelectionStartFromPointer,
  snapMovedBookingDates,
} from "../timelineSelectionConstraints";
import { TIMELINE_CELL_BASE, useTimelineCellWidth } from "../timelineCellWidth";
import {
  applyDragEdgeScroll,
  isNearDragScrollEdge,
  type DragScrollTargets,
} from "../timelineDragAutoScroll";
import { buildInfiniteTimelineRange } from "../timelineInfiniteRange";
import { useTimelineVirtualWindow } from "../useTimelineVirtualWindow";
import {
  consumeSuppressClick,
  handleBookingTouchEnd,
  handleBookingTouchMove,
  handleBookingTouchStart,
} from "../timelineBookingTouch";
import type { BookingRecord, RoomConfig } from "../types";
import {
  getTimelineBookingBlockLayout,
  TIMELINE_BOOKING_BLOCK_LAYOUT,
  TimelineBookingCardContent,
} from "../TimelineBookingCardContent";

const DAYS_LABELS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
/** Мінімальний зазор між сусідніми картками на межі 50% клітинки. */
const BOOKING_BLOCK_GAP = 3;

type TimelineMode = "month" | "continuous";

export interface DesktopTimelineViewProps {
  style?: CSSProperties;
  layout?: "desktop" | "mobile";
  /** false — корінь без id (батьківський #view-grid уже є) */
  useViewRootId?: boolean;
  roomsList?: RoomConfig[];
  bookings?: BookingRecord[];
  onOpenBooking: (event: React.MouseEvent | null, row: number | string) => void;
  onCreateBooking: (room: string, checkIn: string, checkOut: string) => void;
  /** Кнопка «Нова бронь» у розгорнутому вигляді (коли хедер прихований). */
  onNewBooking?: () => void;
  onMoveBooking?: (
    booking: BookingRecord,
    room: RoomConfig,
    checkIn: string,
    checkOut: string
  ) => void;
  onUndoMove?: () => void;
  canUndoMove?: boolean;
  isUndoing?: boolean;
}

type TimelineDay = {
  date: Date;
  dateString: string;
  isToday: boolean;
  isWeekend: boolean;
};

type BookingBlockData = {
  booking: BookingRecord;
  left: number;
  width: number;
  nights: number;
  contentWidth: number;
  statusClass: string;
  guestName: string;
  guestChip: string | null;
  finBadge: { text: string; bg: string; color: string };
  finText: string;
  extensions: { type: "early" | "late"; left: number; width: number }[];
  padLeft: number;
  padRight: number;
};

type TimelineSelectionPointerSession = {
  pointerId: number;
  pointerType: string;
  roomName: string;
  startX: number;
  startY: number;
  startCell: HTMLElement;
  track: HTMLDivElement;
  selecting: boolean;
};

/** Touch must hold this long on a cell before selection starts (keeps pan/scroll free). */
const TOUCH_SELECT_HOLD_MS = 500;
const TOUCH_SELECT_HOLD_MS_ANDROID = 350;
const TOUCH_SELECT_MOVE_CANCEL_PX = 10;

function buildDayAtIndex(startDate: Date, index: number, today: Date): TimelineDay {
  const d = new Date(startDate);
  d.setDate(startDate.getDate() + index);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  return {
    date: d,
    dateString: formatDateKey(d),
    isToday: d.getTime() === today.getTime(),
    isWeekend: dow === 0 || dow === 5 || dow === 6,
  };
}

function buildDays(startDate: Date, daysCount: number): TimelineDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: TimelineDay[] = [];
  for (let i = 0; i < daysCount; i++) {
    days.push(buildDayAtIndex(startDate, i, today));
  }
  return days;
}

function isCalendarMonthStart(dateStr: string): boolean {
  const date = parseSafeDate(dateStr);
  return date ? date.getDate() === 1 : false;
}

function isCalendarMonthEnd(dateStr: string): boolean {
  const date = parseSafeDate(dateStr);
  if (!date) return false;
  const next = new Date(date);
  next.setDate(date.getDate() + 1);
  return next.getMonth() !== date.getMonth();
}

function buildDaysRange(startDate: Date, fromIndex: number, toIndex: number): TimelineDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: TimelineDay[] = [];
  for (let i = fromIndex; i <= toIndex; i++) {
    days.push(buildDayAtIndex(startDate, i, today));
  }
  return days;
}

function buildMonthBands(
  days: TimelineDay[],
  cellWidth: number
): { label: string; width: number }[] {
  const bands: { label: string; width: number }[] = [];
  let currentMonth = days[0]?.date.getMonth();
  let monthName = days[0]?.date.toLocaleString("uk-UA", { month: "long", year: "numeric" }) ?? "";
  let daysInMonth = 0;
  for (const day of days) {
    if (day.date.getMonth() !== currentMonth) {
      bands.push({ label: monthName, width: daysInMonth * cellWidth });
      currentMonth = day.date.getMonth();
      monthName = day.date.toLocaleString("uk-UA", { month: "long", year: "numeric" });
      daysInMonth = 1;
    } else {
      daysInMonth++;
    }
  }
  if (daysInMonth > 0) bands.push({ label: monthName, width: daysInMonth * cellWidth });
  return bands;
}

function buildBookingBlocks(
  room: RoomConfig,
  roomBookings: BookingRecord[],
  startDate: Date,
  daysCount: number,
  cellWidth: number
): BookingBlockData[] {
  const timelineStart = new Date(startDate);
  timelineStart.setHours(0, 0, 0, 0);
  const blocks: BookingBlockData[] = [];

  for (const b of roomBookings) {
    const inDate = parseSafeDate(b.checkIn);
    const outDate = parseSafeDate(b.checkOut);
    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) continue;

    inDate.setHours(0, 0, 0, 0);
    outDate.setHours(0, 0, 0, 0);

    const checkInDayIndex = Math.round((inDate.getTime() - timelineStart.getTime()) / 86400000);
    const checkoutDayIndex = Math.round((outDate.getTime() - timelineStart.getTime()) / 86400000);
    const nights = checkoutDayIndex - checkInDayIndex;
    if (nights <= 0) continue;
    // Як у old_boso_mobile: показуємо, якщо бронь перетинає видимий період
    if (!(checkoutDayIndex > 0 && checkInDayIndex < daysCount)) continue;

    const finBadge = getTimelineFinBadge(b);

    const comment = b.comment ? String(b.comment) : "";
    const { hasEarly: exHasEarly, hasLate: exHasLate } = bookingHasEarlyLate(comment);

    const halfCell = cellWidth / 2;
    const minBlockWidth = 20;
    const gridRight = daysCount * cellWidth;

    // Заїзд — з середини дня (15:00) або з початку при ранньому; виїзд — до середини (11:00) або до кінця при пізньому
    let blockLeft = checkInDayIndex * cellWidth + (exHasEarly ? 0 : halfCell);
    let blockRight = checkoutDayIndex * cellWidth + (exHasLate ? cellWidth : halfCell);

    // Обрізка, якщо бронь виходить за межі видимої сітки
    blockLeft = Math.max(blockLeft, 0);
    blockRight = Math.min(blockRight, gridRight);
    if (blockRight <= blockLeft) continue;

    let blockWidth = Math.max(blockRight - blockLeft, minBlockWidth);

    const blockGap = nights === 1 ? 1 : BOOKING_BLOCK_GAP;
    blockLeft += blockGap;
    blockWidth = Math.max(blockWidth - blockGap * 2, minBlockWidth);

    const extensions: BookingBlockData["extensions"] = [];
    const extContentPad = Math.round(halfCell * 0.78) + 16;
    let padLeft = nights === 1 ? 3 : 10;
    let padRight = nights === 1 ? 3 : 10;

    if (exHasEarly && checkInDayIndex >= 0) {
      extensions.push({ type: "early", left: checkInDayIndex * cellWidth, width: halfCell });
      padLeft = extContentPad;
    }

    if (exHasLate) {
      extensions.push({
        type: "late",
        left: checkoutDayIndex * cellWidth + halfCell,
        width: halfCell,
      });
      padRight = extContentPad;
    }

    const contentWidth = blockWidth - padLeft - padRight;
    const finText =
      nights === 1
        ? finBadge.text === "—"
          ? finBadge.text
          : finBadge.text.replace(/\s*грн\s*$/i, "").trim()
        : formatTimelineFinText(finBadge, contentWidth);
    const guestChip = formatTimelineGuestChip(b);

    blocks.push({
      booking: b,
      left: blockLeft,
      width: blockWidth,
      nights,
      contentWidth,
      statusClass: getTimelineStatusClass(b),
      guestName: displayClientName(b.name),
      guestChip,
      finBadge,
      finText,
      extensions,
      padLeft,
      padRight,
    });
  }
  return blocks;
}

export function DesktopTimelineView({
  style,
  layout = "desktop",
  useViewRootId = true,
  roomsList = [],
  bookings = [],
  onOpenBooking,
  onCreateBooking,
  onNewBooking,
  onMoveBooking,
  onUndoMove,
  canUndoMove = false,
  isUndoing = false,
}: DesktopTimelineViewProps) {
  const isMobile = layout === "mobile";
  const isAndroid = isMobile && isAndroidUserAgent(
    typeof navigator !== "undefined" ? navigator.userAgent : ""
  );
  const { isCompactMode, toggleCompactMode } = useGridFocusModeOptional();
  /** Desktop: focus layout. Mobile: denser rows only (same toggle). */
  const compactGrid = !isMobile && isCompactMode;
  const mobileDense = isMobile && isCompactMode;
  const denseRows = compactGrid || mobileDense;
  /** Desktop focus layout: sticky dates via transform sync. Mobile uses unified board scroll. */
  const stickyChrome = compactGrid;
  const mobileBoard = isMobile;
  const activeRooms = useMemo(() => roomsList.filter((r) => r.active), [roomsList]);
  const timelineRooms = useMemo(() => [...activeRooms, HOLDING_ROOM], [activeRooms]);

  useEffect(() => {
    if (!isMobile) return;
    // Dense chrome tweaks only on Android — iOS keeps the pre-density layout.
    document.body.classList.toggle("boso-grid-dense", Boolean(mobileDense && isAndroid));
    document.body.classList.add("boso-grid-view");
    return () => {
      document.body.classList.remove("boso-grid-dense");
      document.body.classList.remove("boso-grid-view");
    };
  }, [isMobile, mobileDense, isAndroid]);

  /**
   * Android: fit all cottage rows on one screen.
   * iOS: keep classic fixed row heights (52 / 60).
   */
  const cottageCount = Math.max(activeRooms.length, 1);
  const mobileDateHeadHeight = isAndroid ? (mobileDense ? 36 : 56) : mobileDense ? 48 : 56;
  const [androidRowHeight, setAndroidRowHeight] = useState(mobileDense ? 38 : 44);

  const [mode, setMode] = useState<TimelineMode>("month");
  const [infiniteAnchor, setInfiniteAnchor] = useState(() => new Date());
  const [baseDate, setBaseDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [dragRoom, setDragRoom] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);
  const [pointerSelectingRoom, setPointerSelectingRoom] = useState<string | null>(null);
  const [draggingBookingKey, setDraggingBookingKey] = useState<string | number | null>(null);
  const [isBookingDragging, setIsBookingDragging] = useState(false);
  const [bookingDragHoverKey, setBookingDragHoverKey] = useState<string | null>(null);
  const [cellHoverPreview, setCellHoverPreview] = useState<{
    room: string;
    checkIn: string;
    checkOut: string;
  } | null>(null);
  const cellHoverPreviewRef = useRef(cellHoverPreview);
  cellHoverPreviewRef.current = cellHoverPreview;
  const isDraggingRef = useRef(false);
  const dragAnchorRef = useRef<string | null>(null);
  const selectionPointerSessionRef = useRef<TimelineSelectionPointerSession | null>(null);
  const touchSelectHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchScrollLockRef = useRef<((e: TouchEvent) => void) | null>(null);
  const selectionMoveCleanupRef = useRef<(() => void) | null>(null);
  const isBookingDraggingRef = useRef(false);
  const bookingDragHoverRef = useRef<string | null>(null);
  const gridSelectionRef = useRef({ dragRoom: null as string | null, dragStart: null as string | null, dragEnd: null as string | null });
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridHeadScrollRef = useRef<HTMLDivElement>(null);
  const headTrackRef = useRef<HTMLDivElement>(null);
  const sidebarBodyScrollRef = useRef<HTMLDivElement>(null);
  const focusBodyScrollRef = useRef<HTMLDivElement>(null);
  const scrollSyncRef = useRef(false);
  const gridRowsRef = useRef<HTMLDivElement>(null);
  const draggingBlockRef = useRef<BookingBlockData | null>(null);
  const dragFloatRef = useRef<HTMLDivElement>(null);
  const moveSessionRef = useRef<BookingMoveSession | null>(null);
  const moveCleanupRef = useRef<(() => void) | null>(null);
  const dragEndedAtRef = useRef(0);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const lastDragFramePointerRef = useRef({ x: 0, y: 0 });
  const dragAutoScrollRafRef = useRef<number | null>(null);
  const verticalPageRef = useRef<HTMLElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressShownRef = useRef(false);
  const longPressTargetRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!isMobile || !isAndroid) return;
    const el = scrollRef.current;
    if (!el) return;

    const measure = () => {
      const available = el.clientHeight - mobileDateHeadHeight;
      if (available < 80) return;
      const raw = Math.floor(available / cottageCount);
      const minH = mobileDense ? 34 : 42;
      const maxH = mobileDense ? 44 : 54;
      const next = Math.min(maxH, Math.max(minH, raw));
      setAndroidRowHeight((prev) => (prev === next ? prev : next));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [isMobile, isAndroid, mobileDense, cottageCount, mobileDateHeadHeight]);

  const rowHeight = isMobile
    ? isAndroid
      ? androidRowHeight
      : mobileDense
        ? 52
        : 60
    : getTimelineRowHeight(compactGrid);

  const infiniteRange = useMemo(
    () => buildInfiniteTimelineRange(infiniteAnchor),
    [infiniteAnchor]
  );

  const startDate = useMemo(() => {
    if (mode === "continuous") return new Date(infiniteRange.start);
    return new Date(baseDate);
  }, [mode, baseDate, infiniteRange.start]);

  const daysCount = useMemo(() => {
    if (mode === "month") {
      return new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
    }
    return infiniteRange.daysCount;
  }, [mode, startDate, infiniteRange.daysCount]);

  const fittedCellWidth = useTimelineCellWidth(scrollRef, daysCount, !isMobile && mode === "month");
  const cellWidth = mode === "continuous" ? TIMELINE_CELL_BASE : fittedCellWidth;
  const isVirtualTimeline = mode === "continuous";
  const gridTotalWidth = daysCount * cellWidth;

  const { window: virtualWindow, scheduleRecompute } = useTimelineVirtualWindow(
    scrollRef,
    daysCount,
    cellWidth,
    isVirtualTimeline,
    isBookingDraggingRef
  );

  gridSelectionRef.current = { dragRoom, dragStart, dragEnd };

  useEffect(() => {
    isBookingDraggingRef.current = isBookingDragging;
  }, [isBookingDragging]);

  const syncFocusHeadTrack = useCallback((scrollLeft: number) => {
    const track = headTrackRef.current;
    if (!track) return;
    track.style.transform = `translate3d(${-scrollLeft}px, 0, 0)`;
  }, []);

  const days = useMemo(() => buildDays(startDate, daysCount), [startDate, daysCount]);
  const renderDays = useMemo(() => {
    if (!isVirtualTimeline) return days;
    return buildDaysRange(startDate, virtualWindow.startIndex, virtualWindow.endIndex);
  }, [days, isVirtualTimeline, startDate, virtualWindow.startIndex, virtualWindow.endIndex]);
  const monthBands = useMemo(() => buildMonthBands(days, cellWidth), [days, cellWidth]);

  const activeBookings = useMemo(
    () => bookings.filter((b) => !String(b.status).toLowerCase().includes("скас")),
    [bookings]
  );

  const constraintsByRoom = useMemo(
    () => buildTimelineConstraintsByRoom(activeBookings, activeRooms),
    [activeBookings, activeRooms]
  );

  const gridByRoom = useMemo(() => {
    const byRoomId = new Map<number, BookingRecord[]>();

    for (const room of timelineRooms) {
      byRoomId.set(Number(room.id), []);
    }

    for (const b of activeBookings) {
      if (b.assignmentState === "holding") {
        byRoomId.get(Number(HOLDING_ROOM.id))?.push(b);
        continue;
      }
      const room = findRoomForBooking(b, activeRooms);
      if (room) {
        const list = byRoomId.get(Number(room.id));
        if (list) list.push(b);
        continue;
      }

      // A booking whose room was deleted becomes unassigned instead of
      // resurrecting the removed room as an extra timeline row.
      byRoomId.get(Number(HOLDING_ROOM.id))?.push(b);
    }

    const rows = activeRooms.map((room) => ({
      room,
      blocks: buildBookingBlocks(
        room,
        byRoomId.get(Number(room.id)) || [],
        startDate,
        daysCount,
        cellWidth
      ),
      isOrphan: false,
    }));

    rows.push({
      room: HOLDING_ROOM,
      blocks: buildBookingBlocks(
        HOLDING_ROOM,
        byRoomId.get(Number(HOLDING_ROOM.id)) || [],
        startDate,
        daysCount,
        cellWidth
      ),
      isOrphan: false,
    });

    return rows;
  }, [activeRooms, timelineRooms, activeBookings, startDate, daysCount, cellWidth]);
  const dragRooms = useMemo(() => gridByRoom.map(({ room }) => room), [gridByRoom]);

  const monthLabel = startDate.toLocaleString("uk-UA", { month: "long", year: "numeric" });

  const timelineNavLabel =
    mode === "continuous" ? (
      <InfinityIcon className="timeline-nav-infinite-icon" strokeWidth={2.25} aria-hidden />
    ) : (
      monthLabel
    );

  useEffect(() => {
    if (!stickyChrome) return;
    const grid = scrollRef.current;
    if (grid) syncFocusHeadTrack(grid.scrollLeft);
  }, [stickyChrome, syncFocusHeadTrack]);

  const resetToToday = useCallback(() => {
    const d = new Date();
    if (mode === "month") {
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      setBaseDate(d);
    } else {
      setInfiniteAnchor(new Date());
    }
  }, [mode]);

  const shiftTimeline = useCallback(
    (dir: number) => {
      if (mode === "continuous") {
        const grid = scrollRef.current;
        if (!grid) return;
        grid.scrollLeft += dir * 7 * cellWidth;
        if (stickyChrome && !mobileBoard) {
          syncFocusHeadTrack(grid.scrollLeft);
        }
        scheduleRecompute();
        return;
      }
      setBaseDate((prev) => {
        const d = new Date(prev);
        d.setDate(1);
        d.setMonth(d.getMonth() + dir);
        return d;
      });
    },
    [mode, cellWidth, stickyChrome, mobileBoard, scheduleRecompute, syncFocusHeadTrack]
  );

  const setTimelineMode = useCallback((m: TimelineMode) => {
    setMode(m);
    if (m === "month") {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      setBaseDate(d);
    } else {
      setInfiniteAnchor(new Date());
    }
  }, []);

  const clearSelection = useCallback(() => {
    setDragRoom(null);
    setDragStart(null);
    setDragEnd(null);
    setCellHoverPreview(null);
    dragAnchorRef.current = null;
    isDraggingRef.current = false;
    if (typeof window !== "undefined") {
      (window as Window & { isGridDragging?: boolean }).isGridDragging = false;
    }
  }, []);

  const releaseTouchScrollLock = useCallback(() => {
    if (touchScrollLockRef.current) {
      document.removeEventListener("touchmove", touchScrollLockRef.current);
      touchScrollLockRef.current = null;
    }
  }, []);

  const clearSelectionMoveListeners = useCallback(() => {
    selectionMoveCleanupRef.current?.();
    selectionMoveCleanupRef.current = null;
  }, []);

  const acquireTouchScrollLock = useCallback(() => {
    if (touchScrollLockRef.current) return;
    const lock = (e: TouchEvent) => {
      if (isDraggingRef.current) e.preventDefault();
    };
    touchScrollLockRef.current = lock;
    document.addEventListener("touchmove", lock, { passive: false });
  }, []);

  const finishDrag = useCallback(() => {
    if (moveSessionRef.current) return;
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setPointerSelectingRoom(null);
    clearSelectionMoveListeners();
    releaseTouchScrollLock();
    if (dragAutoScrollRafRef.current != null) {
      cancelAnimationFrame(dragAutoScrollRafRef.current);
      dragAutoScrollRafRef.current = null;
    }
    const selection = gridSelectionRef.current;
    if (selection.dragRoom && selection.dragStart && selection.dragEnd) {
      const sorted = [selection.dragStart, selection.dragEnd].sort();
      const checkInStr = sorted[0];
      const checkOutStr = shiftDateKey(sorted[sorted.length - 1], 1);
      onCreateBooking(selection.dragRoom, checkInStr, checkOutStr);
    }
    setTimeout(clearSelection, 300);
  }, [onCreateBooking, clearSelection, clearSelectionMoveListeners, releaseTouchScrollLock]);

  useEffect(() => () => {
    moveCleanupRef.current?.();
    moveCleanupRef.current = null;
    moveSessionRef.current = null;
    draggingBlockRef.current = null;
    selectionMoveCleanupRef.current?.();
    selectionMoveCleanupRef.current = null;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (touchSelectHoldTimerRef.current) {
      clearTimeout(touchSelectHoldTimerRef.current);
      touchSelectHoldTimerRef.current = null;
    }
    if (touchScrollLockRef.current) {
      document.removeEventListener("touchmove", touchScrollLockRef.current);
      touchScrollLockRef.current = null;
    }
    longPressTargetRef.current?.classList.remove("pressing");
    longPressTargetRef.current = null;
    if (dragAutoScrollRafRef.current != null) {
      cancelAnimationFrame(dragAutoScrollRafRef.current);
    }
    bosoLeave();
  }, []);

  useEffect(() => {
    const onEnd = (event: PointerEvent) => {
      const session = selectionPointerSessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      if (touchSelectHoldTimerRef.current) {
        clearTimeout(touchSelectHoldTimerRef.current);
        touchSelectHoldTimerRef.current = null;
      }
      const wasSelecting = session.selecting;
      selectionPointerSessionRef.current = null;
      setPointerSelectingRoom(null);
      clearSelectionMoveListeners();
      releaseTouchScrollLock();
      if (wasSelecting) {
        // Commit only on real finger/mouse release — not on pointercancel.
        if (event.type === "pointerup") {
          finishDrag();
        } else {
          clearSelection();
        }
      }
    };
    document.addEventListener("pointerup", onEnd);
    document.addEventListener("pointercancel", onEnd);
    return () => {
      document.removeEventListener("pointerup", onEnd);
      document.removeEventListener("pointercancel", onEnd);
    };
  }, [finishDrag, clearSelection, clearSelectionMoveListeners, releaseTouchScrollLock]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    verticalPageRef.current = document.querySelector(".main-content");
  }, [compactGrid]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let scrollLeft = 0;
    if (mode === "month") {
      if (
        startDate.getMonth() === today.getMonth() &&
        startDate.getFullYear() === today.getFullYear()
      ) {
        scrollLeft = Math.max(0, (today.getDate() - 3) * cellWidth);
      }
    } else {
      const todayIndex = Math.round((today.getTime() - startDate.getTime()) / 86400000);
      scrollLeft = Math.max(0, (todayIndex - 3) * cellWidth);
    }
    el.scrollLeft = scrollLeft;
    if (stickyChrome && !mobileBoard) {
      syncFocusHeadTrack(scrollLeft);
    }
    scheduleRecompute();
  }, [
    mode,
    infiniteAnchor,
    startDate,
    daysCount,
    cellWidth,
    stickyChrome,
    mobileBoard,
    scheduleRecompute,
    syncFocusHeadTrack,
  ]);

  const handleGridContainerScroll = useCallback(() => {
    if (scrollSyncRef.current) return;
    const grid = scrollRef.current;
    const sidebar = sidebarBodyScrollRef.current;
    if (!grid) return;

    if (mobileBoard) {
      if (!isBookingDraggingRef.current) {
        scheduleRecompute();
      }
      return;
    }

    scrollSyncRef.current = true;
    if (stickyChrome) {
      syncFocusHeadTrack(grid.scrollLeft);
    }
    if (stickyChrome && sidebar && sidebar.scrollTop !== grid.scrollTop) {
      sidebar.scrollTop = grid.scrollTop;
    }
    scrollSyncRef.current = false;
    if (!isBookingDraggingRef.current) {
      scheduleRecompute();
    }
  }, [stickyChrome, mobileBoard, scheduleRecompute, syncFocusHeadTrack]);

  const handleSidebarBodyScroll = useCallback(() => {
    if (mobileBoard || scrollSyncRef.current) return;
    const sidebar = sidebarBodyScrollRef.current;
    const grid = scrollRef.current;
    if (!sidebar || !grid) return;

    scrollSyncRef.current = true;
    if (grid.scrollTop !== sidebar.scrollTop) {
      grid.scrollTop = sidebar.scrollTop;
    }
    scrollSyncRef.current = false;
  }, [mobileBoard]);

  const handleGridWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (!stickyChrome || mobileBoard) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const sidebar = sidebarBodyScrollRef.current;
      if (!sidebar) return;
      event.preventDefault();
      sidebar.scrollTop += event.deltaY;
    },
    [stickyChrome, mobileBoard]
  );

  const clearDragUiState = useCallback(() => {
    draggingBlockRef.current = null;
    bookingDragHoverRef.current = null;
    setBookingDragHoverKey(null);
    setDraggingBookingKey(null);
    setIsBookingDragging(false);
    isBookingDraggingRef.current = false;
  }, []);

  const updateDragFloatPosition = useCallback(
    (session: BookingMoveSession, block: BookingBlockData) => {
      const el = dragFloatRef.current;
      const scroll = scrollRef.current;
      const rowsEl = gridRowsRef.current;
      if (!el || !scroll) return;

      const { x, y } = lastPointerRef.current;
      const rect = scroll.getBoundingClientRect();
      const xInGrid = x - rect.left + scroll.scrollLeft;
      const pixelDelta = xInGrid - session.startXInGrid;
      session.deltaDays = Math.round(pixelDelta / cellWidth);

      if (rowsEl) {
        // Visual hit-test: rows move with the unified board scroll (incl. sticky head).
        session.targetRoomIndex = resolveTargetRoomIndex(
          y,
          rowsEl.getBoundingClientRect().top,
          dragRooms.length,
          rowHeight
        );
      }

      const layout = getTimelineBookingBlockLayout(rowHeight, denseRows);
      const top = session.targetRoomIndex * rowHeight + layout.top;
      const left = block.left + pixelDelta;
      el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      el.style.width = `${block.width}px`;
      el.style.height = `${layout.height}px`;
    },
    [dragRooms.length, cellWidth, rowHeight, denseRows]
  );

  const getDragScrollTargets = useCallback((): DragScrollTargets => {
    return {
      horizontal: scrollRef.current,
      vertical: stickyChrome || mobileBoard ? scrollRef.current : null,
      verticalSync: stickyChrome && !mobileBoard ? sidebarBodyScrollRef.current : null,
      verticalPage: stickyChrome || mobileBoard ? null : verticalPageRef.current,
    };
  }, [stickyChrome, mobileBoard]);

  const dragScrollOptions = useCallback(
    () => ({ viewportEdges: isMobile }),
    [isMobile]
  );

  const updateTimelineSelectionRef = useRef<
    (roomName: string, clientX: number, clientY: number) => void
  >(() => {});

  const stopDragAutoScroll = useCallback(() => {
    if (dragAutoScrollRafRef.current != null) {
      cancelAnimationFrame(dragAutoScrollRafRef.current);
      dragAutoScrollRafRef.current = null;
    }
  }, []);

  const runDragFrame = useCallback(() => {
    const moveSession = moveSessionRef.current;
    const block = draggingBlockRef.current;
    const selecting =
      isDraggingRef.current &&
      Boolean(selectionPointerSessionRef.current?.selecting) &&
      !moveSession?.previewActive;

    if (!((moveSession?.previewActive && block) || selecting)) {
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
    if (scrolled && stickyChrome && !mobileBoard) {
      const el = scrollRef.current;
      if (el) syncFocusHeadTrack(el.scrollLeft);
    }
    scrollSyncRef.current = false;

    if (moveSession?.previewActive && block) {
      updateDragFloatPosition(moveSession, block);
    } else if (selecting) {
      const session = selectionPointerSessionRef.current;
      if (session?.selecting) {
        updateTimelineSelectionRef.current(session.roomName, x, y);
      }
    }

    dragAutoScrollRafRef.current = requestAnimationFrame(runDragFrame);
  }, [
    stickyChrome,
    mobileBoard,
    getDragScrollTargets,
    dragScrollOptions,
    syncFocusHeadTrack,
    updateDragFloatPosition,
  ]);

  const ensureDragFrame = useCallback(() => {
    if (dragAutoScrollRafRef.current != null) return;
    dragAutoScrollRafRef.current = requestAnimationFrame(runDragFrame);
  }, [runDragFrame]);

  const attachSelectionMoveListeners = useCallback(
    (pointerId: number) => {
      clearSelectionMoveListeners();
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const session = selectionPointerSessionRef.current;
        if (!session?.selecting || !isDraggingRef.current) return;
        if (ev.cancelable) ev.preventDefault();
        lastPointerRef.current = { x: ev.clientX, y: ev.clientY };
        ensureDragFrame();
        updateTimelineSelectionRef.current(session.roomName, ev.clientX, ev.clientY);
      };
      document.addEventListener("pointermove", onMove, { passive: false });
      selectionMoveCleanupRef.current = () => {
        document.removeEventListener("pointermove", onMove);
        selectionMoveCleanupRef.current = null;
      };
    },
    [clearSelectionMoveListeners, ensureDragFrame]
  );

  const clearMoveListeners = useCallback(() => {
    moveCleanupRef.current?.();
    moveCleanupRef.current = null;
  }, []);

  const finishBookingDrag = useCallback(
    (session: BookingMoveSession) => {
      clearMoveListeners();
      moveSessionRef.current = null;

      const targetRoom = dragRooms[session.targetRoomIndex];
      const roomChanged = session.targetRoomIndex !== session.activeRoomIndex;
      const hasMove =
        session.moved &&
        targetRoom &&
        onMoveBooking &&
        (session.deltaDays !== 0 || roomChanged);

      if (hasMove) {
        dragEndedAtRef.current = Date.now();
        const newCheckIn = shiftDateKey(session.booking.checkIn, session.deltaDays);
        const newCheckOut = shiftDateKey(session.booking.checkOut, session.deltaDays);
        const roomBookings = activeBookings.filter((b) => {
          if (String(targetRoom.id) === String(HOLDING_ROOM.id)) {
            return b.assignmentState === "holding";
          }
          const room = findRoomForBooking(b, activeRooms);
          return room?.id === targetRoom.id;
        });
        const snapped = isHoldingRoom(targetRoom)
          ? { checkIn: newCheckIn, checkOut: newCheckOut }
          : snapMovedBookingDates(
              newCheckIn,
              newCheckOut,
              buildRoomTimelineConstraints(
                roomBookings,
                bookingMoveKey(session.booking)
              )
            );
        if (snapped) {
          onMoveBooking(session.booking, targetRoom, snapped.checkIn, snapped.checkOut);
        }
      }

      stopDragAutoScroll();
      clearDragUiState();
      scheduleRecompute();
    },
    [activeBookings, activeRooms, dragRooms, clearDragUiState, clearMoveListeners, onMoveBooking, scheduleRecompute, stopDragAutoScroll]
  );

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressTargetRef.current?.classList.remove("pressing");
    longPressTargetRef.current = null;
  }, []);

  const handleBookingPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, block: BookingBlockData, gridRowIndex: number) => {
      if (!onMoveBooking) return;
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (String(block.booking.status).toLowerCase().includes("скас")) return;

      const activeRoomIndex = resolveActiveRoomIndex(block.booking, dragRooms);
      if (activeRoomIndex < 0) return;

      e.preventDefault();
      e.stopPropagation();

      const target = e.currentTarget;
      clearLongPress();
      longPressShownRef.current = false;

      if (e.pointerType === "touch") {
        longPressTargetRef.current = target;
        target.classList.add("pressing");
        longPressTimerRef.current = setTimeout(() => {
          const session = moveSessionRef.current;
          if (!session || session.moved) return;
          longPressShownRef.current = true;
          if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(40);
          bosoHover(target, block.booking.row, "main");
        }, 420);
      } else {
        bosoLeave();
      }

      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        /* ignore — capture is best-effort on some browsers */
      }

      const scrollEl = scrollRef.current;
      const gridRect = scrollEl?.getBoundingClientRect();
      const scrollLeft = scrollEl?.scrollLeft ?? 0;
      const xInGrid = e.clientX - (gridRect?.left ?? 0) + scrollLeft;
      const moveThreshold = e.pointerType === "touch" ? 10 : BOOKING_MOVE_THRESHOLD;

      clearMoveListeners();

      moveSessionRef.current = {
        booking: block.booking,
        blockLeft: block.left,
        blockWidth: block.width,
        gridRowIndex,
        activeRoomIndex,
        startX: e.clientX,
        startY: e.clientY,
        startXInGrid: xInGrid,
        deltaDays: 0,
        targetRoomIndex: activeRoomIndex,
        moved: false,
        pointerId: e.pointerId,
      };

      const onDocMove = (ev: PointerEvent) => {
        const session = moveSessionRef.current;
        if (!session || ev.pointerId !== session.pointerId) return;

        lastPointerRef.current = { x: ev.clientX, y: ev.clientY };

        const dx = ev.clientX - session.startX;
        const dy = ev.clientY - session.startY;
        if (!session.moved && Math.hypot(dx, dy) < moveThreshold) return;

        clearLongPress();
        bosoLeave();
        longPressShownRef.current = false;
        session.moved = true;

        if (!session.previewActive) {
          session.previewActive = true;
          draggingBlockRef.current = block;
          isBookingDraggingRef.current = true;
          setIsBookingDragging(true);
          setCellHoverPreview(null);
          setDraggingBookingKey(bookingMoveKey(session.booking));
          lastDragFramePointerRef.current = { x: 0, y: 0 };
          updateDragFloatPosition(session, block);
        }

        ensureDragFrame();
      };

      const onDocUp = (ev: PointerEvent) => {
        const session = moveSessionRef.current;
        if (!session || ev.pointerId !== session.pointerId) return;
        stopDragAutoScroll();

        const wasPeek = !session.moved && longPressShownRef.current;
        clearLongPress();
        bosoLeave();
        longPressShownRef.current = false;

        if (wasPeek) {
          clearMoveListeners();
          moveSessionRef.current = null;
          dragEndedAtRef.current = Date.now();
          return;
        }

        finishBookingDrag(session);
      };

      const onDocCancel = (ev: PointerEvent) => {
        const session = moveSessionRef.current;
        if (!session || ev.pointerId !== session.pointerId) return;
        stopDragAutoScroll();
        clearLongPress();
        bosoLeave();
        longPressShownRef.current = false;
        clearMoveListeners();
        moveSessionRef.current = null;
        clearDragUiState();
      };

      document.addEventListener("pointermove", onDocMove);
      document.addEventListener("pointerup", onDocUp);
      document.addEventListener("pointercancel", onDocCancel);
      moveCleanupRef.current = () => {
        document.removeEventListener("pointermove", onDocMove);
        document.removeEventListener("pointerup", onDocUp);
        document.removeEventListener("pointercancel", onDocCancel);
      };
    },
    [
      dragRooms,
      clearDragUiState,
      clearLongPress,
      clearMoveListeners,
      ensureDragFrame,
      finishBookingDrag,
      onMoveBooking,
      stopDragAutoScroll,
      updateDragFloatPosition,
    ]
  );

  const selectionKey =
    dragRoom && dragStart && dragEnd ? `${dragRoom}:${dragStart}:${dragEnd}` : "";

  const selectedClassForDate = useCallback((roomName: string, dateStr: string): string => {
    const { dragRoom: room, dragStart: start, dragEnd: end } = gridSelectionRef.current;
    if (!room || room !== roomName || !start || !end) return "";
    const sorted = [start, end].sort();
    const rangeStart = sorted[0];
    const rangeEnd = sorted[sorted.length - 1];
    const checkOutDay = shiftDateKey(rangeEnd, 1);

    if (dateStr === checkOutDay && rangeStart !== rangeEnd) {
      return "cell-selected-tail";
    }
    if (dateStr < rangeStart || dateStr > rangeEnd) return "";

    let cls = "cell-selected";
    if (dateStr === rangeStart) cls += " cell-selected-start";
    if (dateStr === rangeEnd) cls += " cell-selected-end";
    return cls;
  }, []);

  const startTimelineSelection = useCallback(
    (roomName: string, cell: HTMLElement, clientX: number, useHoverPreview: boolean) => {
      const date = cell.dataset.date;
      if (!date) return false;

      const constraints = constraintsByRoom.get(roomName);
      const activePreview = useHoverPreview ? cellHoverPreviewRef.current : null;
      const start =
        activePreview?.room === roomName
          ? activePreview.checkIn
          : resolveSelectionStartFromPointer(
              date,
              clientX,
              cell.getBoundingClientRect(),
              constraints
            );

      setCellHoverPreview(null);
      isDraggingRef.current = true;
      if (typeof window !== "undefined") {
        (window as Window & { isGridDragging?: boolean }).isGridDragging = true;
      }
      dragAnchorRef.current = start;
      gridSelectionRef.current = { dragRoom: roomName, dragStart: start, dragEnd: start };
      setDragRoom(roomName);
      setDragStart(start);
      setDragEnd(start);
      setPointerSelectingRoom(roomName);
      return true;
    },
    [constraintsByRoom]
  );

  const updateTimelineSelection = useCallback(
    (roomName: string, clientX: number, clientY: number) => {
      const cell = document
        .elementFromPoint(clientX, clientY)
        ?.closest(".timeline-cell[data-date][data-room]") as HTMLElement | null;
      if (!cell || cell.dataset.room !== roomName) return;

      const date = cell.dataset.date;
      const anchor = dragAnchorRef.current;
      if (!date || !anchor) return;

      const movingNight = resolveSelectionNightFromPointer(
        date,
        clientX,
        cell.getBoundingClientRect()
      );
      const constraints = constraintsByRoom.get(roomName);
      const next = constraints
        ? clampSelectionWithAnchor(anchor, movingNight, constraints)
        : {
            start: anchor <= movingNight ? anchor : movingNight,
            end: anchor <= movingNight ? movingNight : anchor,
          };

      gridSelectionRef.current = {
        dragRoom: roomName,
        dragStart: next.start,
        dragEnd: next.end,
      };
      setDragStart(next.start);
      setDragEnd(next.end);
    },
    [constraintsByRoom]
  );
  updateTimelineSelectionRef.current = updateTimelineSelection;

  const onTrackPointerDown = useCallback(
    (roomName: string, event: ReactPointerEvent<HTMLDivElement>) => {
      if (isBookingDraggingRef.current || moveSessionRef.current) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const cell = (event.target as HTMLElement).closest(
        ".timeline-cell[data-date][data-room]"
      ) as HTMLElement | null;
      if (!cell || cell.dataset.room !== roomName || !cell.dataset.date) return;

      // Android/WebView sometimes reports "" instead of "touch".
      const isTouch = event.pointerType !== "mouse";
      if (touchSelectHoldTimerRef.current) {
        clearTimeout(touchSelectHoldTimerRef.current);
        touchSelectHoldTimerRef.current = null;
      }

      selectionPointerSessionRef.current = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        roomName,
        startX: event.clientX,
        startY: event.clientY,
        startCell: cell,
        track: event.currentTarget,
        selecting: !isTouch,
      };

      if (!isTouch) {
        lastPointerRef.current = { x: event.clientX, y: event.clientY };
        startTimelineSelection(roomName, cell, event.clientX, true);
        attachSelectionMoveListeners(event.pointerId);
        ensureDragFrame();
        return;
      }

      // Touch: wait for long-press before selecting so pan/scroll stays free.
      const holdMs = isAndroid ? TOUCH_SELECT_HOLD_MS_ANDROID : TOUCH_SELECT_HOLD_MS;
      touchSelectHoldTimerRef.current = setTimeout(() => {
        touchSelectHoldTimerRef.current = null;
        const session = selectionPointerSessionRef.current;
        if (!session || session.pointerId !== event.pointerId || session.selecting) return;
        session.selecting = true;
        acquireTouchScrollLock();
        try {
          session.track.setPointerCapture(session.pointerId);
        } catch {
          /* Pointer capture is best-effort on older mobile browsers. */
        }
        lastPointerRef.current = { x: session.startX, y: session.startY };
        startTimelineSelection(roomName, session.startCell, session.startX, false);
        attachSelectionMoveListeners(session.pointerId);
        ensureDragFrame();
      }, holdMs);
    },
    [
      isAndroid,
      startTimelineSelection,
      acquireTouchScrollLock,
      attachSelectionMoveListeners,
      ensureDragFrame,
    ]
  );

  const onCellMouseEnter = useCallback((_roomName: string, _dateString: string) => {
    // Виділення оновлюється через рух вказівника (half-cell), не через enter цілої клітинки.
  }, []);

  const visibleDateSet = useMemo(
    () => new Set(renderDays.map((day) => day.dateString)),
    [renderDays]
  );

  const hoverPreviewKey = cellHoverPreview
    ? `${cellHoverPreview.room}:${cellHoverPreview.checkIn}:${cellHoverPreview.checkOut}`
    : "";

  const hoverClassForDate = useCallback(
    (roomName: string, dateStr: string): string => {
      const preview = cellHoverPreview;
      if (!preview || preview.room !== roomName) return "";

      const checkInVisible = visibleDateSet.has(preview.checkIn);
      const checkOutVisible = visibleDateSet.has(preview.checkOut);
      const onCheckIn = dateStr === preview.checkIn && checkInVisible;
      const onCheckOut = dateStr === preview.checkOut && checkOutVisible;
      if (!onCheckIn && !onCheckOut) return "";

      let baseClass = "";
      if (onCheckIn && checkOutVisible) {
        baseClass = "cell-hover-preview-one-night";
      } else if (onCheckIn && !checkOutVisible) {
        baseClass = "cell-hover-preview-checkin-only";
      } else if (onCheckOut && !checkInVisible) {
        baseClass = "cell-hover-preview-checkout-only";
      }
      if (!baseClass) return "";

      const flipCorners =
        (isCalendarMonthStart(dateStr) && baseClass === "cell-hover-preview-checkout-only") ||
        (isCalendarMonthEnd(dateStr) && baseClass === "cell-hover-preview-checkin-only");

      return flipCorners ? `${baseClass} cell-hover-preview--flip-corners` : baseClass;
    },
    [cellHoverPreview, visibleDateSet]
  );

  const onTrackPointerMove = useCallback((roomName: string, event: ReactPointerEvent<HTMLDivElement>) => {
    if (isBookingDraggingRef.current || moveSessionRef.current) return;

    const session = selectionPointerSessionRef.current;
    // Match by pointerId only — finger can drift onto another row while selecting.
    if (session?.pointerId === event.pointerId) {
      if (!session.selecting && session.pointerType !== "mouse") {
        const dx = event.clientX - session.startX;
        const dy = event.clientY - session.startY;
        if (Math.hypot(dx, dy) >= TOUCH_SELECT_MOVE_CANCEL_PX) {
          // Finger moved before long-press → this is a scroll/pan, not a selection.
          if (touchSelectHoldTimerRef.current) {
            clearTimeout(touchSelectHoldTimerRef.current);
            touchSelectHoldTimerRef.current = null;
          }
          selectionPointerSessionRef.current = null;
          clearSelectionMoveListeners();
          releaseTouchScrollLock();
        }
        return;
      }

      if (session.selecting && isDraggingRef.current) {
        event.preventDefault();
        lastPointerRef.current = { x: event.clientX, y: event.clientY };
        ensureDragFrame();
        updateTimelineSelection(session.roomName, event.clientX, event.clientY);
        return;
      }
    }

    if (event.pointerType !== "mouse") return;

    const cell = (event.target as HTMLElement).closest(
      ".timeline-cell[data-date][data-room]"
    ) as HTMLElement | null;

    if (!cell || cell.dataset.room !== roomName) {
      setCellHoverPreview(null);
      return;
    }

    const date = cell.dataset.date;
    if (!date) return;

    const rect = cell.getBoundingClientRect();
    const isRightHalf = event.clientX - rect.left >= rect.width / 2;
    const constraints = constraintsByRoom.get(roomName);
    const preview = constraints
      ? resolveHoverPreviewRange(date, isRightHalf, constraints)
      : {
          checkIn: isRightHalf ? date : shiftDateKey(date, -1),
          checkOut: isRightHalf ? shiftDateKey(date, 1) : date,
        };

    if (!preview || preview.checkIn >= preview.checkOut) {
      setCellHoverPreview(null);
      return;
    }

    setCellHoverPreview((prev) => {
      if (
        prev?.room === roomName &&
        prev.checkIn === preview.checkIn &&
        prev.checkOut === preview.checkOut
      ) {
        return prev;
      }
      return { room: roomName, checkIn: preview.checkIn, checkOut: preview.checkOut };
    });
  }, [
    constraintsByRoom,
    updateTimelineSelection,
    clearSelectionMoveListeners,
    releaseTouchScrollLock,
    ensureDragFrame,
  ]);

  const onTrackPointerLeave = useCallback((roomName: string) => {
    setCellHoverPreview((prev) => (prev?.room === roomName ? null : prev));
  }, []);

  const iconClock = (
    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const bookingBlockLayout = isMobile
    ? getTimelineBookingBlockLayout(rowHeight, true)
    : denseRows
      ? getTimelineBookingBlockLayout(rowHeight, true)
      : TIMELINE_BOOKING_BLOCK_LAYOUT;
  const bookingBlockStyle =
    isMobile || denseRows
      ? { top: bookingBlockLayout.top, height: bookingBlockLayout.height }
      : bookingBlockLayout;

  const rootStyle: CSSProperties | undefined = isMobile
    ? { display: "flex", flexDirection: "column", flex: "1 1 0%", minHeight: 0, ...style }
    : style;

  const timelineMonths = (
    <div
      className={`timeline-months${isVirtualTimeline ? " timeline-track--virtual" : ""}`}
      id="timelineMonths"
      style={isVirtualTimeline ? { width: gridTotalWidth, minWidth: gridTotalWidth } : undefined}
    >
      {monthBands.map((band, i) => (
        <div key={i} className="timeline-month-cell" style={{ width: band.width }}>
          {band.label}
        </div>
      ))}
    </div>
  );

  const timelineDates = (
    <div
      className={`timeline-dates${isVirtualTimeline ? " timeline-track--virtual" : ""}`}
      id="timelineDates"
      style={isVirtualTimeline ? { width: gridTotalWidth, minWidth: gridTotalWidth } : undefined}
    >
      <div
        className="timeline-track-window"
        style={isVirtualTimeline ? { marginLeft: virtualWindow.offsetPx } : undefined}
      >
        {renderDays.map((day) => (
          <div
            key={day.dateString}
            className={`timeline-date${day.isToday ? " today" : ""}${day.isWeekend ? " weekend" : ""}`}
          >
            {day.date.getDate()} <span>{DAYS_LABELS[day.date.getDay()]}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const timelineRoomRows = gridByRoom.map(({ room }) => (
    <TimelineRoomRow
      key={room.id}
      room={room}
      className={isHoldingRoom(room) ? "timeline-room--holding" : ""}
      compact={denseRows}
      showDesc={!isMobile && !compactGrid}
      style={{ height: rowHeight, minHeight: rowHeight, maxHeight: rowHeight }}
    />
  ));

  const visibleBlockRange = useMemo(() => {
    if (!isVirtualTimeline) return null;
    return {
      startPx: virtualWindow.startIndex * cellWidth,
      endPx: (virtualWindow.endIndex + 1) * cellWidth,
    };
  }, [isVirtualTimeline, virtualWindow.startIndex, virtualWindow.endIndex, cellWidth]);

  const isBlockVisible = useCallback(
    (block: BookingBlockData) => {
      if (!visibleBlockRange) return true;
      return (
        block.left + block.width >= visibleBlockRange.startPx &&
        block.left <= visibleBlockRange.endPx
      );
    },
    [visibleBlockRange]
  );

  const renderDaysForCells = useMemo(
    () => renderDays.map((day) => ({ dateString: day.dateString, isWeekend: day.isWeekend })),
    [renderDays]
  );

  const timelineRows = (
    <>
      {gridByRoom.map(({ room, blocks }, roomIndex) => (
        <TimelineGridRow
          key={room.id}
          rowId={room.id}
          rowIndex={roomIndex}
          isVirtualTimeline={isVirtualTimeline}
          gridTotalWidth={gridTotalWidth}
          virtualOffsetPx={virtualWindow.offsetPx}
          renderDays={renderDaysForCells}
          selectionKey={selectionKey}
          hoverPreviewKey={hoverPreviewKey}
          selectedClassForDate={selectedClassForDate}
          hoverClassForDate={hoverClassForDate}
          bookingDragHoverKey={bookingDragHoverKey}
          isPointerSelecting={pointerSelectingRoom === room.name}
          onTrackPointerDown={onTrackPointerDown}
          onCellMouseEnter={onCellMouseEnter}
          onTrackPointerMove={onTrackPointerMove}
          onTrackPointerLeave={onTrackPointerLeave}
          roomName={room.name}
          blocksSignature={`${room.id}:${draggingBookingKey}:${denseRows ? "d" : "n"}:${rowHeight}:${blocks
            .map((b) => `${b.booking.row}:${b.guestChip}:${b.finText}:${b.nights}`)
            .join(",")}`}
        >
          {blocks.map((block) => {
            const isDraggingCard =
              draggingBookingKey != null &&
              bookingMoveKey(block.booking) === draggingBookingKey;
            const mobileExtensionInset = denseRows ? 16 : 20;
            const hasEarlyExtension = block.extensions.some((ext) => ext.type === "early");
            const hasLateExtension = block.extensions.some((ext) => ext.type === "late");
            const mobilePadX = denseRows ? 4 : 5;
            const mobileExtPad = mobileExtensionInset + (denseRows ? 4 : 6);

            if (isDraggingCard || !isBlockVisible(block)) return null;

            return (
              <div
                key={String(bookingMoveKey(block.booking))}
                className={`booking-block ${block.statusClass}${block.nights === 1 ? " micro-booking" : ""}${block.nights >= 2 ? " booking-block--multi-night" : ""}`}
                style={{
                  left: block.left,
                  width: block.width,
                  position: "absolute",
                  paddingLeft:
                    isMobile
                      ? hasEarlyExtension
                        ? mobileExtPad
                        : block.nights === 1
                          ? 3
                          : mobilePadX
                      : block.padLeft,
                  paddingRight:
                    isMobile
                      ? hasLateExtension
                        ? mobileExtPad
                        : block.nights === 1
                          ? 3
                          : mobilePadX
                      : block.padRight,
                  cursor: onMoveBooking ? "grab" : "pointer",
                  touchAction: onMoveBooking ? "none" : undefined,
                  ...bookingBlockStyle,
                }}
                onPointerDown={
                  onMoveBooking ? (e) => handleBookingPointerDown(e, block, roomIndex) : undefined
                }
                onMouseDown={onMoveBooking ? (e) => e.stopPropagation() : undefined}
                onClick={(e) => {
                  if (Date.now() - dragEndedAtRef.current < 250) return;
                  if (isMobile && consumeSuppressClick()) return;
                  onOpenBooking(e, block.booking.id || block.booking.row);
                }}
                onMouseEnter={
                  isMobile ? undefined : (e) => bosoHover(e.currentTarget, block.booking.row, "main")
                }
                onMouseLeave={isMobile ? undefined : () => bosoLeave()}
                onTouchStart={
                  isMobile && !onMoveBooking
                    ? (e) =>
                        handleBookingTouchStart(e, e.currentTarget, block.booking.row, "main")
                    : undefined
                }
                onTouchMove={
                  isMobile && !onMoveBooking
                    ? (e) => handleBookingTouchMove(e.currentTarget)
                    : undefined
                }
                onTouchEnd={
                  isMobile && !onMoveBooking
                    ? (e) =>
                        handleBookingTouchEnd(e, e.currentTarget, block.booking.row, () =>
                          onOpenBooking(null, block.booking.id || block.booking.row)
                        )
                    : undefined
                }
                onContextMenu={isMobile ? (e) => e.preventDefault() : undefined}
              >
                {block.extensions.map((ext, idx) => (
                  <div
                    key={idx}
                    className={`time-extension ${ext.type}${isMobile ? " time-extension--mobile" : ""}`}
                    style={{
                      width: isMobile ? mobileExtensionInset : ext.width,
                      left: isMobile
                        ? ext.type === "early"
                          ? 0
                          : "auto"
                        : ext.left - block.left,
                      right: isMobile && ext.type === "late" ? 0 : "auto",
                      position: "absolute",
                      height: "100%",
                    }}
                    onMouseEnter={
                      isMobile
                        ? undefined
                        : (e) => {
                            e.stopPropagation();
                            bosoHover(e.currentTarget, block.booking.row, ext.type);
                          }
                    }
                    onMouseLeave={
                      isMobile
                        ? undefined
                        : (e) => {
                            e.stopPropagation();
                            const parent = e.currentTarget.parentElement as HTMLElement | null;
                            if (parent) {
                              bosoHover(parent, block.booking.row, "main");
                            } else {
                              bosoLeave();
                            }
                          }
                    }
                    onPointerDown={
                      isMobile
                        ? (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        : undefined
                    }
                    onClick={
                      isMobile
                        ? (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            bosoHover(e.currentTarget, block.booking.row, ext.type);
                          }
                        : undefined
                    }
                  >
                    {iconClock}
                  </div>
                ))}
                <TimelineBookingCardContent
                  block={block}
                  mobile={isMobile}
                  compact={denseRows}
                  androidPremium={isAndroid}
                />
              </div>
            );
          })}
        </TimelineGridRow>
      ))}

      {draggingBookingKey != null && draggingBlockRef.current ? (
        <div
          ref={dragFloatRef}
          className={`booking-block ${draggingBlockRef.current.statusClass} booking-block--drag-float${draggingBlockRef.current.nights === 1 ? " micro-booking" : ""}${draggingBlockRef.current.nights >= 2 ? " booking-block--multi-night" : ""}`}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: draggingBlockRef.current.width,
            height: getTimelineBookingBlockLayout(rowHeight, denseRows).height,
            paddingLeft:
              isMobile
                ? draggingBlockRef.current.extensions.some((ext) => ext.type === "early")
                  ? (denseRows ? 16 : 20) + (denseRows ? 4 : 6)
                  : draggingBlockRef.current.nights === 1
                    ? 3
                    : denseRows
                      ? 4
                      : 5
                : draggingBlockRef.current.padLeft,
            paddingRight:
              isMobile
                ? draggingBlockRef.current.extensions.some((ext) => ext.type === "late")
                  ? (denseRows ? 16 : 20) + (denseRows ? 4 : 6)
                  : draggingBlockRef.current.nights === 1
                    ? 3
                    : denseRows
                      ? 4
                      : 5
                : draggingBlockRef.current.padRight,
            pointerEvents: "none",
            transform: `translate3d(${draggingBlockRef.current.left}px, ${getTimelineBookingBlockLayout(rowHeight, denseRows).top}px, 0)`,
          }}
        >
          {draggingBlockRef.current.extensions.map((ext, idx) => (
            <div
              key={idx}
              className={`time-extension ${ext.type}${isMobile ? " time-extension--mobile" : ""}`}
              style={{
                width: isMobile ? (denseRows ? 16 : 20) : ext.width,
                left: isMobile
                  ? ext.type === "early"
                    ? 0
                    : "auto"
                  : ext.left - draggingBlockRef.current!.left,
                right: isMobile && ext.type === "late" ? 0 : "auto",
                position: "absolute",
                height: "100%",
              }}
            >
              {iconClock}
            </div>
          ))}
          <TimelineBookingCardContent
            block={draggingBlockRef.current}
            mobile={isMobile}
            compact={denseRows}
            androidPremium={isAndroid}
          />
        </div>
      ) : null}
    </>
  );

  const wrapperClassName = [
    "timeline-wrapper",
    isBookingDragging ? "timeline-wrapper--booking-drag" : "",
    stickyChrome ? "timeline-wrapper--focus-layout" : "",
    compactGrid ? "timeline-wrapper--compact" : "",
    mobileBoard ? "timeline-wrapper--mobile-board" : "",
    mobileDense ? "timeline-wrapper--mobile-dense" : "",
    isAndroid ? "timeline-wrapper--android" : "",
    isAndroid && mobileDense ? "timeline-wrapper--android-dense" : "",
    pointerSelectingRoom ? "timeline-wrapper--cell-selecting" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const sidebarUndoProps =
    onUndoMove && !isMobile ? { onUndoMove, canUndoMove, isUndoing } : {};

  const timelineUndoButton =
    isMobile && onUndoMove ? (
      <button
        type="button"
        className={`timeline-undo-btn timeline-undo-btn--toolbar tap-btn${isUndoing ? " timeline-undo-btn--busy" : ""}`}
        onClick={onUndoMove}
        disabled={!canUndoMove || isUndoing}
        aria-label="Скасувати останню дію"
        aria-busy={isUndoing}
        title={canUndoMove ? "Скасувати останню дію" : "Немає дій для скасування"}
      >
        <Undo2 className="timeline-undo-btn__icon" strokeWidth={2} aria-hidden />
      </button>
    ) : null;

  const timelineDensityButton = isMobile ? (
    <button
      type="button"
      className={`timeline-focus-toggle timeline-focus-toggle--toolbar tap-btn${mobileDense ? " is-active" : ""}`}
      onClick={toggleCompactMode}
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
  ) : null;

  const timelineMonthNav = (
    <div
      className={`timeline-nav${mode === "continuous" ? " timeline-nav--infinite" : ""}`}
      style={
        isMobile
          ? { height: 40, minHeight: 40, maxHeight: 40, padding: "0 6px", boxSizing: "border-box" }
          : undefined
      }
    >
      <button
        type="button"
        className="btn-icon timeline-nav-arrow"
        onClick={() => shiftTimeline(-1)}
        aria-label="Попередній період"
        style={
          isMobile
            ? { width: 28, height: 28, minWidth: 28, minHeight: 28, padding: 0 }
            : undefined
        }
      >
        <svg width={isMobile ? 12 : 14} height={isMobile ? 12 : 14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span
        className={`timeline-month-label${mode === "continuous" ? " timeline-month-label--infinite" : ""}`}
        id="timelineMonthLabel"
      >
        {timelineNavLabel}
      </span>
      <button
        type="button"
        className="btn-icon timeline-nav-arrow"
        onClick={() => shiftTimeline(1)}
        aria-label="Наступний період"
        style={
          isMobile
            ? { width: 28, height: 28, minWidth: 28, minHeight: 28, padding: 0 }
            : undefined
        }
      >
        <svg width={isMobile ? 12 : 14} height={isMobile ? 12 : 14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );

  const timelineTodayButton = (
    <button
      type="button"
      className={`btn-secondary timeline-today-btn${isMobile ? " tap-btn" : ""}`}
      onClick={resetToToday}
      style={
        isMobile
          ? {
              height: 40,
              minHeight: 40,
              maxHeight: 40,
              padding: "0 14px",
              fontSize: 12,
              fontWeight: 700,
              width: "auto",
              flex: "0 0 auto",
              boxSizing: "border-box",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 10,
              lineHeight: 1,
            }
          : { padding: "8px 16px", fontSize: 13 }
      }
    >
      Сьогодні
    </button>
  );

  const timelineModeToggle = (
    <div className="mode-toggle" role="group" aria-label="Режим шахматки">
      <button
        type="button"
        id="mode-month"
        className={`mode-btn${mode === "month" ? " active" : ""}`}
        onClick={() => setTimelineMode("month")}
        aria-pressed={mode === "month"}
      >
        Місяць
      </button>
      <button
        type="button"
        id="mode-cont"
        className={`mode-btn mode-btn--infinite${mode === "continuous" ? " active" : ""}`}
        onClick={() => setTimelineMode("continuous")}
        title="Безкінечна шкала (±3 роки)"
        aria-label="Безкінечна шкала"
        aria-pressed={mode === "continuous"}
      >
        <InfinityIcon className="mode-btn--infinite__icon" strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );

  const timelineToolbar = compactGrid && !isMobile ? (
    <div className="price-grid-toolbar timeline-toolbar--focus">
      <div className="price-grid-toolbar__nav">
        {timelineMonthNav}
        {timelineTodayButton}
      </div>
      <div className="price-grid-toolbar__actions">
        {timelineModeToggle}
        {onNewBooking ? (
          <button type="button" className="btn-primary" onClick={onNewBooking}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Нова бронь
          </button>
        ) : null}
      </div>
    </div>
  ) : (
    <div className={`timeline-toolbar${mobileDense ? " timeline-toolbar--dense-focus" : ""}`}>
      {isMobile ? (
        <>
          <div className="timeline-nav-row" aria-hidden={mobileDense || undefined}>
            {timelineMonthNav}
            {timelineTodayButton}
          </div>
          <div className="timeline-toolbar-actions">
            {timelineUndoButton}
            {timelineModeToggle}
            {timelineDensityButton}
          </div>
        </>
      ) : (
        <>
          {timelineMonthNav}
          {timelineTodayButton}
          {timelineModeToggle}
        </>
      )}
    </div>
  );

  return (
    <div
      id={useViewRootId ? "view-grid" : undefined}
      className={[
        stickyChrome || mobileBoard ? "timeline-view-root--focus" : "",
        mobileDense ? "timeline-view-root--mobile-dense" : "",
      ]
        .filter(Boolean)
        .join(" ") || undefined}
      style={rootStyle}
    >
      {timelineToolbar}

      <div
        className={wrapperClassName}
        style={
          {
            "--timeline-cell-width": `${cellWidth}px`,
            "--timeline-room-height": `${rowHeight}px`,
            "--timeline-row-height": `${rowHeight}px`,
            "--timeline-mobile-head-height": `${isMobile ? mobileDateHeadHeight : 56}px`,
            "--timeline-grid-width": `${gridTotalWidth}px`,
          } as CSSProperties
        }
      >
        {mobileBoard ? (
          <div
            className="timeline-mobile-scroll timeline-scroll-surface"
            id="timelineScroll"
            ref={scrollRef}
            onScroll={handleGridContainerScroll}
          >
            <div
              className="timeline-mobile-board"
              style={{
                width: gridTotalWidth + 88,
                minWidth: gridTotalWidth + 88,
              }}
            >
              <div className="timeline-mobile-head">
                <div className="timeline-mobile-corner">
                  <TimelineSidebarHeader
                    roomCount={activeRooms.length}
                    showFocusToggle={false}
                    {...sidebarUndoProps}
                  />
                </div>
                <div
                  className="timeline-mobile-dates"
                  style={{ width: gridTotalWidth, minWidth: gridTotalWidth }}
                >
                  {timelineMonths}
                  {timelineDates}
                </div>
              </div>
              <div className="timeline-mobile-body">
                <div className="timeline-mobile-rooms" id="timelineRooms">
                  {timelineRoomRows}
                </div>
                <div
                  className={`timeline-rows timeline-mobile-cells${isVirtualTimeline ? " timeline-rows--virtual" : ""}`}
                  id="timelineGrid"
                  ref={gridRowsRef}
                  style={{ width: gridTotalWidth, minWidth: gridTotalWidth }}
                >
                  {timelineRows}
                </div>
              </div>
            </div>
          </div>
        ) : stickyChrome ? (
          <>
            <div className="timeline-focus-head">
              <div className="timeline-sidebar timeline-sidebar--focus-head">
                <TimelineSidebarHeader
                  roomCount={activeRooms.length}
                  showFocusToggle={!isMobile}
                  {...sidebarUndoProps}
                />
              </div>
              <div className="timeline-grid-head" ref={gridHeadScrollRef}>
                <div className="timeline-head-track" ref={headTrackRef}>
                  {timelineMonths}
                  {timelineDates}
                </div>
              </div>
            </div>
            <div className="timeline-focus-body" ref={focusBodyScrollRef}>
              <div
                className="timeline-sidebar timeline-sidebar--focus-body"
                ref={sidebarBodyScrollRef}
                onScroll={handleSidebarBodyScroll}
              >
                <div id="timelineRooms">{timelineRoomRows}</div>
              </div>
              <div
                className="timeline-grid-container timeline-scroll-surface"
                id="timelineScroll"
                ref={scrollRef}
                onScroll={handleGridContainerScroll}
                onWheel={handleGridWheel}
              >
                <div
                  className={`timeline-rows${isVirtualTimeline ? " timeline-rows--virtual" : ""}`}
                  id="timelineGrid"
                  ref={gridRowsRef}
                  style={
                    isVirtualTimeline
                      ? { width: gridTotalWidth, minWidth: gridTotalWidth }
                      : undefined
                  }
                >
                  {timelineRows}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="timeline-sidebar">
              <TimelineSidebarHeader
                roomCount={activeRooms.length}
                showFocusToggle={!isMobile}
                {...sidebarUndoProps}
              />
              <div id="timelineRooms">{timelineRoomRows}</div>
            </div>

            <div className="timeline-grid-container timeline-scroll-surface" id="timelineScroll" ref={scrollRef}>
              {timelineMonths}
              {timelineDates}
              <div
                className={`timeline-rows${isVirtualTimeline ? " timeline-rows--virtual" : ""}`}
                id="timelineGrid"
                ref={gridRowsRef}
                style={
                  isVirtualTimeline ? { width: gridTotalWidth, minWidth: gridTotalWidth } : undefined
                }
              >
                {timelineRows}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
