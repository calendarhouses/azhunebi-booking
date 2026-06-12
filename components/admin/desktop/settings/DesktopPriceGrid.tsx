"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatDateKey } from "../bookingUtils";
import { TimelineSidebarHeader, TimelineRoomRow } from "../TimelineSidebarRooms";
import { isPriceWeekend } from "./restrictionGridUtils";
import {
  formatMonthYearLabel,
  formatPriceAmount,
  measurePriceCellWidth,
  measurePriceEditWidth,
  parsePriceInput,
  PRICE_CELL_MIN,
  PRICE_ROW_HEIGHT,
  PRICE_GRID_DATES_HEIGHT,
  PRICE_GRID_HEADER_HEIGHT,
  PRICE_GRID_MONTH_HEIGHT,
} from "./priceGridUtils";
import { buildGridSelectionPreset } from "./priceConstructorLogic";
import type { AdminModalsApi } from "../useAdminModals";
import type { AdminSettingsPayload } from "../types";

const DAYS_LABELS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const DRAG_THRESHOLD_PX = 5;

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
  onDragMouseDown,
  onDragMouseEnter,
}: {
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
  onDragMouseDown: (e: React.MouseEvent) => void;
  onDragMouseEnter: () => void;
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

  const cellStyle = { width, minWidth: width, height: PRICE_ROW_HEIGHT, minHeight: PRICE_ROW_HEIGHT };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onStartEdit(true);
  };

  if (editing) {
    return (
      <div className={cellClass} style={cellStyle}>
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
      onDoubleClick={handleDoubleClick}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        onDragMouseDown(e);
      }}
      onMouseEnter={onDragMouseEnter}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onStartEdit(false);
        }
      }}
    >
      <div className="flex h-full w-full items-center justify-center whitespace-nowrap px-2">
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
}

export function DesktopPriceGrid({ settings, modals, baseDateRef, layout = "desktop" }: DesktopPriceGridProps) {
  const isMobile = layout === "mobile";
  const [, bump] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editCell, setEditCell] = useState<EditCell>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingCell, setSavingCell] = useState<string | null>(null);
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
      const roomPrices = customPrices[String(room.id)];
      dayMeta.forEach((day, i) => {
        let price = day.isWeekend ? room.priceWeekend : room.priceWeekday;
        if (roomPrices?.[day.dateStr]) price = roomPrices[day.dateStr];
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
  }, [activeRooms, customPrices, dayMeta, daysCount, editCell, editDraft]);

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
    } else {
      el.scrollLeft = 0;
    }
  }, [startDate, daysCount]);

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

  const onCellMouseDown = useCallback(
    (roomId: string, dateStr: string, e: React.MouseEvent) => {
      if (e.button !== 0) return;

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
    },
    [editCell, editDraft, commitInlinePrice]
  );

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
      }
    },
    [computeDragHighlight]
  );

  const openInlineEdit = useCallback(
    (roomId: string, dateStr: string, selectAll = false) => {
      const room = activeRooms.find((r) => String(r.id) === roomId);
      const day = dayMeta.find((d) => d.dateStr === dateStr);
      let price = 0;
      if (room && day) {
        price = day.isWeekend ? room.priceWeekend : room.priceWeekday;
        const rp = customPrices[roomId];
        if (rp?.[dateStr]) price = rp[dateStr];
      }
      scrollPreserveRef.current = scrollRef.current?.scrollLeft ?? 0;
      setDragHighlight(null);
      setEditCell({ roomId, dateStr, selectAll });
      setEditDraft(String(price));
    },
    [activeRooms, dayMeta, customPrices]
  );

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag.active) return;
    drag.active = false;

    const highlight = computeDragHighlight(
      drag.anchorRoomId,
      drag.focusRoomId,
      drag.anchorDateStr,
      drag.focusDateStr
    );
    setDragHighlight(null);

    if (!highlight) return;

    const cellCount = highlight.roomIds.length * highlight.dateStrs.length;
    if (cellCount > 1 || drag.moved) {
      setEditCell(null);
      setEditDraft("");
      modals.openPriceConstructor(
        buildGridSelectionPreset(highlight.roomIds, highlight.dateStrs, activeRooms.length)
      );
      return;
    }

    openInlineEdit(highlight.roomIds[0], highlight.dateStrs[0], false);
  }, [activeRooms.length, computeDragHighlight, modals, openInlineEdit]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag.active || drag.moved) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      setDragHighlight(
        computeDragHighlight(
          drag.anchorRoomId,
          drag.focusRoomId,
          drag.anchorDateStr,
          drag.focusDateStr
        )
      );
    };

    const onMouseUp = () => finishDrag();

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [finishDrag, computeDragHighlight]);

  return (
    <>
      <div className={`price-grid-toolbar${isMobile ? " price-grid-toolbar--mobile" : ""}`}>
        <div className="price-grid-toolbar__nav">
          <div className="timeline-nav">
            <button type="button" className={`btn-icon${isMobile ? " tap-btn" : ""}`} onClick={() => shift(-1)}>
              <svg width={isMobile ? 14 : 16} height={isMobile ? 14 : 16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="timeline-month-label" id="priceMonthLabel">
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
            onClick={() => modals.clearPricesAlert()}
          >
            {isMobile ? "Очистити" : "Видалити ціни"}
          </button>
          <button
            type="button"
            className={`btn-primary${isMobile ? " tap-btn" : ""}`}
            onClick={() => modals.openPriceConstructor()}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Конструктор
          </button>
        </div>
      </div>

      <div
        className="price-grid-premium"
        style={{
          ["--price-grid-month-h" as string]: `${PRICE_GRID_MONTH_HEIGHT}px`,
          ["--price-grid-dates-h" as string]: `${PRICE_GRID_DATES_HEIGHT}px`,
          ["--price-grid-header-h" as string]: `${PRICE_GRID_HEADER_HEIGHT}px`,
          ["--price-grid-row-h" as string]: `${PRICE_ROW_HEIGHT}px`,
        }}
      >
        <div className="timeline-wrapper price-grid-timeline" style={{ marginTop: isMobile ? 0 : 12 }}>
          <div className="timeline-sidebar price-grid-sidebar">
            <TimelineSidebarHeader
              roomCount={activeRooms.length}
              className="price-grid-sidebar-header"
            />
            {activeRooms.map((room) => (
              <TimelineRoomRow
                key={room.id}
                room={room}
                className="price-grid-room"
                showDesc={!isMobile}
              />
            ))}
          </div>
          <div className="timeline-grid-container" ref={scrollRef} id="priceScroll">
            <div className="timeline-months" id="priceMonths">
              <div className="timeline-month-cell" style={{ width: gridTotalWidth }}>
                {monthLabel}
              </div>
            </div>
            <div className="timeline-dates price-grid-dates" id="priceDates">
              {dayMeta.map((day, i) => (
                <div
                  key={day.dateStr}
                  className={`timeline-date price-grid-date${day.isWeekend ? " price-grid-date--weekend" : ""}`}
                  style={{ width: columnWidths[i], minWidth: columnWidths[i] }}
                >
                  {day.date.getDate()} <span>{DAYS_LABELS[day.date.getDay()]}</span>
                </div>
              ))}
            </div>
            <div className="timeline-rows" id="priceGrid">
              {activeRooms.map((room) => (
                <div key={room.id} className="timeline-row-bg price-grid-row">
                  {dayMeta.map((day, i) => {
                    const roomPrices = customPrices[String(room.id)];
                    const isCustom = Boolean(roomPrices?.[day.dateStr]);
                    let price = day.isWeekend ? room.priceWeekend : room.priceWeekday;
                    if (roomPrices?.[day.dateStr]) {
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
                        price={price}
                        isWeekend={day.isWeekend}
                        isCustom={isCustom}
                        width={columnWidths[i]}
                        editing={editing}
                        dragSelectionClasses={selectionClasses}
                        selectAllOnFocus={Boolean(editing && editCell?.selectAll)}
                        onStartEdit={(selectAll) => {
                          if (dragRef.current.active) return;
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
                        onDragMouseDown={(e) => onCellMouseDown(String(room.id), day.dateStr, e)}
                        onDragMouseEnter={() => onCellMouseEnter(String(room.id), day.dateStr)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
