"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { dateWord, dayWord } from "../adminPlural";
import { formatDateKey } from "../bookingUtils";
import { TimelineSidebarHeader, TimelineRoomRow } from "../TimelineSidebarRooms";
import type { AdminModalsApi } from "../useAdminModals";
import type { AdminSettingsPayload } from "../types";
import {
  getRestrictionCellSelectionClasses,
  getRestrictionMinNights,
  getRestrictionSegmentsForRoom,
  isPriceWeekend,
  isSameRestrictionSelection,
  type RestrictionSegment,
} from "./restrictionGridUtils";
import { scrollMainContentToElement } from "./scrollMainContent";
import { useTimelineCellWidth } from "../timelineCellWidth";

const DAYS_LABELS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function RestrictionSegmentBlock({
  roomId,
  segment,
  cellWidth,
  onSelect,
}: {
  roomId: number;
  segment: RestrictionSegment;
  cellWidth: number;
  onSelect: (e: React.MouseEvent, roomId: number, segment: RestrictionSegment) => void;
}) {
  const blockLeft = segment.startIndex * cellWidth + 4;
  const blockWidth = segment.length * cellWidth - 8;
  const { minN } = segment;
  const spanDays = segment.length;
  const title = `Мінімум ${minN} ${dayWord(minN)} — натисніть для дій`;

  if (blockWidth < 72) {
    return (
      <button
        type="button"
        className="booking-block status-confirmed restriction-chip restriction-chip--single"
        style={{ left: blockLeft, width: blockWidth, position: "absolute" }}
        title={title}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => onSelect(e, roomId, segment)}
      >
        <span className="restriction-chip-single-num">{minN}</span>
        <span className="restriction-chip-single-label">мін. діб</span>
      </button>
    );
  }
  if (blockWidth < 130) {
    return (
      <button
        type="button"
        className="booking-block status-confirmed restriction-chip restriction-chip--compact"
        style={{ left: blockLeft, width: blockWidth, position: "absolute" }}
        title={title}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => onSelect(e, roomId, segment)}
      >
        <div
          className="booking-inner-content"
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            justifyContent: "center",
          }}
        >
          <div className="restriction-chip-title">мін. {minN} діб</div>
        </div>
      </button>
    );
  }
  const rangeHint = spanDays > 1 ? ` · ${spanDays} ${dateWord(spanDays)}` : "";
  return (
    <button
      type="button"
      className="booking-block status-confirmed restriction-chip"
      style={{ left: blockLeft, width: blockWidth, position: "absolute" }}
      title={title}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => onSelect(e, roomId, segment)}
    >
      <div
        className="booking-inner-content"
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          width: "100%",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.2,
          }}
        >
          мін. {minN} діб{rangeHint}
        </div>
        <div style={{ marginTop: 4, display: "flex" }}>
          <span
            style={{
              background: "rgba(255,255,255,0.28)",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: 4,
              whiteSpace: "nowrap",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
            }}
          >
            обмеження
          </span>
        </div>
      </div>
    </button>
  );
}

export interface DesktopRestrictionsGridProps {
  settings: AdminSettingsPayload;
  modals: AdminModalsApi;
  baseDateRef: React.MutableRefObject<Date>;
  wrapperRef?: React.RefObject<HTMLDivElement | null>;
  layout?: "desktop" | "mobile";
}

export function DesktopRestrictionsGrid({
  settings,
  modals,
  baseDateRef,
  wrapperRef,
  layout = "desktop",
}: DesktopRestrictionsGridProps) {
  const isMobile = layout === "mobile";
  const [, bump] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    active: false,
    roomId: null as string | null,
    startDate: null as string | null,
    endDate: null as string | null,
  });
  const [dragHighlight, setDragHighlight] = useState<{
    roomId: string;
    dates: string[];
  } | null>(null);

  const restrictions = settings.restrictions || {};
  const selection = modals.restrictionSelection;

  const startDate = useMemo(() => {
    const d = new Date(baseDateRef.current);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [baseDateRef.current.getTime(), bump]);

  const daysCount = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
  const cellWidth = useTimelineCellWidth(scrollRef, daysCount, !isMobile);
  const monthLabel = startDate.toLocaleString("uk-UA", { month: "long", year: "numeric" });
  const activeRooms = (settings.roomsList || []).filter((r) => r.active);
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

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
      renderRestrictionsGrid?: () => void;
    };
    w.shiftRestrictionsTimeline = shift;
    w.resetRestrictionsTimelineToToday = resetToToday;
    w.renderRestrictionsGrid = () => bump((n) => n + 1);
    return () => {
      delete w.shiftRestrictionsTimeline;
      delete w.resetRestrictionsTimelineToToday;
      delete w.renderRestrictionsGrid;
    };
  }, [shift, resetToToday]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (
      scrollEl &&
      startDate.getMonth() === today.getMonth() &&
      startDate.getFullYear() === today.getFullYear()
    ) {
      scrollEl.scrollLeft = Math.max(0, (today.getDate() - 3) * cellWidth);
    }
  }, [startDate, today, daysCount, cellWidth]);

  const getHighlightDates = useCallback((): string[] => {
    if (dragHighlight) return dragHighlight.dates;
    if (selection?.highlightCells && selection.dates) return selection.dates;
    return [];
  }, [dragHighlight, selection]);

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag.active) return;
    drag.active = false;

    if (drag.roomId && drag.startDate && drag.endDate) {
      let d1 = new Date(drag.startDate);
      let d2 = new Date(drag.endDate);
      if (d1 > d2) {
        const t = d1;
        d1 = d2;
        d2 = t;
      }
      const dates: string[] = [];
      const cur = new Date(d1);
      while (cur <= d2) {
        dates.push(formatDateKey(cur));
        cur.setDate(cur.getDate() + 1);
      }
      if (isSameRestrictionSelection(selection, drag.roomId, dates)) {
        modals.setRestrictionSelection(null);
      } else {
        modals.setRestrictionSelection({
          roomId: drag.roomId,
          dates,
          highlightCells: true,
        });
      }
    }
    drag.roomId = null;
    drag.startDate = null;
    drag.endDate = null;
    setDragHighlight(null);
  }, [modals, selection]);

  useEffect(() => {
    const onMouseUp = () => finishDrag();
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, [finishDrag]);

  const updateDragHighlight = (roomId: string, start: string, end: string) => {
    let d1 = new Date(start);
    let d2 = new Date(end);
    if (d1 > d2) {
      const t = d1;
      d1 = d2;
      d2 = t;
    }
    const dates: string[] = [];
    const cur = new Date(d1);
    while (cur <= d2) {
      dates.push(formatDateKey(cur));
      cur.setDate(cur.getDate() + 1);
    }
    setDragHighlight({ roomId, dates });
  };

  const onCellMouseDown = (roomId: string, dateStr: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = {
      active: true,
      roomId,
      startDate: dateStr,
      endDate: dateStr,
    };
    updateDragHighlight(roomId, dateStr, dateStr);
  };

  const onCellMouseEnter = (roomId: string, dateStr: string) => {
    const drag = dragRef.current;
    if (!drag.active || drag.roomId !== roomId) return;
    drag.endDate = dateStr;
    updateDragHighlight(roomId, drag.startDate!, dateStr);
  };

  const onSegmentClick = (
    e: React.MouseEvent,
    roomId: number,
    segment: RestrictionSegment
  ) => {
    e.stopPropagation();
    e.preventDefault();
    modals.setRestrictionSelection({
      roomId: String(roomId),
      dates: [...segment.dates],
      minN: segment.minN,
      highlightCells: false,
    });
    const barEl = e.currentTarget as HTMLElement;
    openRestrictionBarMenu(e, barEl);
  };

  const openRestrictionBarMenu = (e: React.MouseEvent, barEl: HTMLElement) => {
    const menu = document.getElementById("restrictionBarMenu");
    if (!menu) return;
    closeRestrictionBarMenu();
    barEl.classList.add("restriction-chip--menu-open");
    (window as Window & { __restrictionBarMenuEl?: HTMLElement }).__restrictionBarMenuEl = barEl;

    menu.style.display = "flex";
    menu.style.visibility = "hidden";
    menu.classList.remove("restriction-bar-menu--above");

    const rect = barEl.getBoundingClientRect();
    const main = document.querySelector(".main-content");
    const vp = main
      ? (() => {
          const r = main.getBoundingClientRect();
          return { top: r.top + 8, bottom: r.bottom - 8, left: r.left + 8, right: r.right - 8 };
        })()
      : { top: 12, bottom: window.innerHeight - 12, left: 12, right: window.innerWidth - 12 };

    const menuW = menu.offsetWidth || 200;
    const menuH = menu.offsetHeight || 96;
    const gap = 8;
    let left = rect.left + rect.width / 2 - menuW / 2;
    left = Math.max(vp.left, Math.min(left, vp.right - menuW));

    const spaceBelow = vp.bottom - rect.bottom - gap;
    const spaceAbove = rect.top - vp.top - gap;
    let top: number;
    if (spaceBelow >= menuH || spaceBelow > spaceAbove) {
      top = rect.bottom + gap;
    } else {
      top = rect.top - gap - menuH;
      menu.classList.add("restriction-bar-menu--above");
    }
    top = Math.max(vp.top, Math.min(top, vp.bottom - menuH));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.transform = "none";
    menu.style.visibility = "visible";
  };

  const closeRestrictionBarMenu = () => {
    const menu = document.getElementById("restrictionBarMenu");
    if (menu) {
      menu.style.display = "none";
      menu.style.visibility = "";
      menu.classList.remove("restriction-bar-menu--above");
    }
    const barEl = (window as Window & { __restrictionBarMenuEl?: HTMLElement })
      .__restrictionBarMenuEl;
    if (barEl) {
      barEl.classList.remove("restriction-chip--menu-open");
      (window as Window & { __restrictionBarMenuEl?: HTMLElement }).__restrictionBarMenuEl =
        undefined;
    }
  };

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const menu = document.getElementById("restrictionBarMenu");
      if (!menu || menu.style.display === "none") return;
      if (menu.contains(e.target as Node)) return;
      if ((e.target as HTMLElement).closest?.(".restriction-chip")) return;
      closeRestrictionBarMenu();
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const highlightDates = getHighlightDates();
  const highlightRoomId = dragHighlight?.roomId ?? (selection?.highlightCells ? selection.roomId : null);

  const cellClass = (roomId: number, dateStr: string, hasR: boolean, isWeekend: boolean) => {
    const parts = ["restriction-cell", "timeline-cell"];
    if (isWeekend) parts.push("weekend-restr");
    if (hasR) parts.push("has-restriction");
    if (highlightRoomId === String(roomId) && highlightDates.includes(dateStr)) {
      const sorted = [...highlightDates].sort();
      parts.push("cell-selected");
      if (dateStr === sorted[0]) parts.push("cell-selected-start");
      if (dateStr === sorted[sorted.length - 1]) parts.push("cell-selected-end");
    } else {
      const selCls = getRestrictionCellSelectionClasses(selection, roomId, dateStr);
      if (selCls) parts.push(...selCls.split(" ").filter(Boolean));
    }
    return parts.join(" ");
  };

  return (
    <>
      {isMobile ? (
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <button type="button" className="btn-primary tap-btn" onClick={() => modals.openRestrictionConstructor()}>
            Конструктор
          </button>
          <button type="button" className="btn-outline-danger tap-btn" onClick={() => modals.clearRestrictionsAlert()}>
            Видалити
          </button>
        </div>
      ) : (
        <div
          className="settings-toolbar"
          style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}
        >
          <div style={{ display: "flex", gap: 16 }}>
            <button
              type="button"
              className="btn-outline-danger"
              onClick={() => modals.clearRestrictionsAlert()}
              style={{ padding: "10px 16px", fontSize: 13, height: "auto" }}
            >
              Видалити
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => modals.openRestrictionConstructor()}
              style={{ padding: "10px 16px", fontSize: 13 }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Конструктор обмежень
            </button>
          </div>
        </div>
      )}
      {isMobile ? (
        <div className="timeline-nav-row" style={{ marginBottom: 12 }}>
          <div className="timeline-nav">
            <button type="button" className="btn-icon tap-btn" onClick={() => shift(-1)}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="timeline-month-label" id="restrictionMonthLabel">
              {monthLabel}
            </span>
            <button type="button" className="btn-icon tap-btn" onClick={() => shift(1)}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            className="btn-secondary tap-btn"
            onClick={resetToToday}
            style={{ padding: "6px 12px", fontSize: 12, width: "auto", flexShrink: 0 }}
          >
            Сьогодні
          </button>
        </div>
      ) : (
        <div className="timeline-toolbar" style={{ marginTop: 10, justifyContent: "flex-start", gap: 20 }}>
          <div className="timeline-nav">
            <button type="button" className="btn-icon" onClick={() => shift(-1)}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="timeline-month-label" id="restrictionMonthLabel">
              {monthLabel}
            </span>
            <button type="button" className="btn-icon" onClick={() => shift(1)}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={resetToToday}
            style={{ padding: "6px 16px", fontSize: 13 }}
          >
            Поточний місяць
          </button>
        </div>
      )}
      <div className="restriction-hint-slot">
        <p
          className={`restriction-selection-hint ${modals.restrictionHint ? "is-visible" : ""}`}
          aria-live="polite"
        >
          {modals.restrictionHint}
        </p>
      </div>
      <div
        className="timeline-wrapper"
        id="restrictionsTimelineWrapper"
        ref={wrapperRef}
        style={
          (isMobile
            ? { marginTop: 0 }
            : { "--timeline-cell-width": `${cellWidth}px` }) as CSSProperties
        }
      >
        <div className="timeline-sidebar">
          <TimelineSidebarHeader roomCount={activeRooms.length} />
          {activeRooms.map((room) => (
            <TimelineRoomRow key={room.id} room={room} />
          ))}
        </div>
        <div className="timeline-grid-container" ref={scrollRef} id="restrictionScroll">
          <div className="timeline-months" id="restrictionMonths">
            <div className="timeline-month-cell" style={{ width: daysCount * cellWidth }}>
              {monthLabel}
            </div>
          </div>
          <div className="timeline-dates" id="restrictionDates">
            {Array.from({ length: daysCount }, (_, i) => {
              const d = new Date(startDate);
              d.setDate(startDate.getDate() + i);
              const isWeekend = isPriceWeekend(d);
              const isToday = d.getTime() === today.getTime();
              return (
                <div
                  key={i}
                  className={`timeline-date ${isWeekend ? "weekend" : ""} ${isToday ? "today" : ""}`}
                >
                  {d.getDate()} <span>{DAYS_LABELS[d.getDay()]}</span>
                </div>
              );
            })}
          </div>
          <div className="timeline-rows" id="restrictionGrid">
            {activeRooms.map((room) => {
              const segments = getRestrictionSegmentsForRoom(
                restrictions,
                room.id,
                startDate,
                daysCount
              );
              return (
                <div key={room.id} className="timeline-row-bg" style={{ position: "relative" }}>
                  {Array.from({ length: daysCount }, (_, i) => {
                    const d = new Date(startDate);
                    d.setDate(startDate.getDate() + i);
                    const dateStr = formatDateKey(d);
                    const hasR = getRestrictionMinNights(restrictions, room.id, d) > 0;
                    return (
                      <div
                        key={dateStr}
                        role="presentation"
                        className={cellClass(room.id, dateStr, hasR, isPriceWeekend(d))}
                        data-room={room.id}
                        data-date={dateStr}
                        onMouseDown={(e) => onCellMouseDown(String(room.id), dateStr, e)}
                        onMouseEnter={() => onCellMouseEnter(String(room.id), dateStr)}
                      />
                    );
                  })}
                  {segments.map((seg, idx) => (
                    <RestrictionSegmentBlock
                      key={`${room.id}-${seg.startDateStr}-${idx}`}
                      roomId={room.id}
                      segment={seg}
                      cellWidth={cellWidth}
                      onSelect={onSegmentClick}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

export function scrollToRestrictionsGrid(wrapperRef: React.RefObject<HTMLDivElement | null>) {
  scrollMainContentToElement(wrapperRef.current, { offset: 20 });
}
