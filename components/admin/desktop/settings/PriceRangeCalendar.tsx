"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateKey } from "../bookingUtils";
import { formatMonthYearLabel } from "./priceGridUtils";
import { isPriceWeekend } from "./restrictionGridUtils";
import type { AdminSettingsPayload, RoomConfig } from "../types";

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

type PriceRangeCalendarProps = {
  settings: AdminSettingsPayload;
  startDate: string;
  endDate: string;
  selectedRoomIds: string[];
  allRoomsActive: boolean;
  /** Показувати ціни в клітинках (конструктор цін). Для знижок — false */
  showDayPrices?: boolean;
  /** Блокує вибір дат (режим «Діє завжди») */
  disabled?: boolean;
  onRangeChange: (start: string, end: string) => void;
};

function parseIso(iso: string): Date | null {
  const s = String(iso || "").substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function isoFromDate(d: Date): string {
  return formatDateKey(d);
}

function getPreviewRoom(
  settings: AdminSettingsPayload,
  selectedRoomIds: string[],
  allRoomsActive: boolean
): RoomConfig | null {
  const rooms = (settings.roomsList || []).filter((r) => r.active);
  if (!rooms.length) return null;
  if (allRoomsActive || selectedRoomIds.length === 0) return rooms[0];
  return rooms.find((r) => selectedRoomIds.includes(String(r.id))) || rooms[0];
}

function getDayPrice(
  room: RoomConfig,
  date: Date,
  customPrices: AdminSettingsPayload["customPrices"]
): number {
  const dateStr = formatDateKey(date);
  const custom = customPrices?.[String(room.id)]?.[dateStr];
  if (custom != null) return custom;
  return isPriceWeekend(date) ? room.priceWeekend : room.priceWeekday;
}

function isInRange(iso: string, start: string, end: string): boolean {
  if (!start || !end) return false;
  const s = start <= end ? start : end;
  const e = start <= end ? end : start;
  return iso >= s && iso <= e;
}

function rangeEdge(iso: string, start: string, end: string): "start" | "end" | null {
  if (!start || !end) return null;
  const s = start <= end ? start : end;
  const e = start <= end ? end : start;
  if (iso === s) return "start";
  if (iso === e) return "end";
  return null;
}

export function PriceRangeCalendar({
  settings,
  startDate,
  endDate,
  selectedRoomIds,
  allRoomsActive,
  showDayPrices = true,
  disabled = false,
  onRangeChange,
}: PriceRangeCalendarProps) {
  const initial = parseIso(startDate) || new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const previewRoom = useMemo(
    () => getPreviewRoom(settings, selectedRoomIds, allRoomsActive),
    [settings, selectedRoomIds, allRoomsActive]
  );

  const customPrices = settings.customPrices || {};

  const monthLabel = formatMonthYearLabel(new Date(viewYear, viewMonth, 1));

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    // Понеділок = перша колонка
    const pad = (first.getDay() + 6) % 7;
    const items: Array<{ date: Date; iso: string; inMonth: boolean } | null> = [];
    for (let i = 0; i < pad; i++) items.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(viewYear, viewMonth, day, 12, 0, 0, 0);
      items.push({ date, iso: isoFromDate(date), inMonth: true });
    }
    while (items.length % 7 !== 0) items.push(null);
    return items;
  }, [viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const handleDayClick = (iso: string) => {
    if (disabled) {
      onRangeChange(iso, iso);
      return;
    }
    const start = startDate?.substring(0, 10) || "";
    const end = endDate?.substring(0, 10) || "";

    if (start && end && start !== end) {
      onRangeChange(iso, iso);
      return;
    }

    if (start && end && start === end) {
      if (iso === start) return;
      if (iso < start) onRangeChange(iso, start);
      else onRangeChange(start, iso);
      return;
    }

    onRangeChange(iso, iso);
  };

  const rangeHint = disabled
    ? "Знижка діє без обмеження дат"
    : startDate && endDate
      ? startDate === endDate
        ? `Обрано: ${startDate.split("-").reverse().join(".")}`
        : `Обрано: ${startDate.split("-").reverse().join(".")} — ${endDate.split("-").reverse().join(".")}`
      : "Обери одну дату або діапазон";

  return (
    <div className={`price-range-calendar${disabled ? " price-range-calendar--disabled" : ""}`}>
      <div className="price-range-calendar__header">
        <button
          type="button"
          className="price-range-calendar__nav"
          onClick={() => shiftMonth(-1)}
          aria-label="Попередній місяць"
        >
          <ChevronLeft size={18} strokeWidth={2.25} />
        </button>
        <h3 className="price-range-calendar__title">{monthLabel}</h3>
        <button
          type="button"
          className="price-range-calendar__nav"
          onClick={() => shiftMonth(1)}
          aria-label="Наступний місяць"
        >
          <ChevronRight size={18} strokeWidth={2.25} />
        </button>
      </div>

      <div className="price-range-calendar__weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="price-range-calendar__weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="price-range-calendar__grid">
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="price-range-calendar__cell price-range-calendar__cell--empty" />;
          }

          const { iso, date } = cell;
          const weekend = isPriceWeekend(date);
          const inRange = isInRange(iso, startDate, endDate);
          const edge = rangeEdge(iso, startDate, endDate);
          const isSingle =
            Boolean(startDate && endDate && startDate === endDate && iso === startDate.substring(0, 10));
          const price = previewRoom ? getDayPrice(previewRoom, date, customPrices) : 0;

          const classNames = [
            "price-range-calendar__cell",
            "price-range-calendar__cell--day",
            weekend ? "price-range-calendar__cell--weekend" : "",
            inRange && !isSingle ? "price-range-calendar__cell--in-range" : "",
            edge === "start" && !isSingle ? "price-range-calendar__cell--range-start" : "",
            edge === "end" && !isSingle ? "price-range-calendar__cell--range-end" : "",
            isSingle ? "price-range-calendar__cell--single" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={iso}
              type="button"
              className={classNames}
              onClick={() => handleDayClick(iso)}
            >
              <span className="price-range-calendar__day-num">{date.getDate()}</span>
              {showDayPrices && previewRoom ? (
                <span className="price-range-calendar__day-price">{price}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="price-range-calendar__hint">{rangeHint}</p>
    </div>
  );
}
