"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateKey } from "./bookingUtils";
import { formatMonthYearLabel } from "./settings/priceGridUtils";

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

type BookingStayRangeCalendarProps = {
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
};

function parseIso(iso: string): Date | null {
  const s = String(iso || "").substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoPlusDays(iso: string, days: number): string {
  const d = parseIso(iso);
  if (!d) return "";
  d.setDate(d.getDate() + days);
  return formatDateKey(d);
}

function isInStayRange(iso: string, start: string, end: string): boolean {
  if (!start || !end) return false;
  return iso >= start && iso <= end;
}

function rangeEdge(iso: string, start: string, end: string): "start" | "end" | null {
  if (!start) return null;
  if (iso === start) return "start";
  if (end && iso === end) return "end";
  return null;
}

export function BookingStayRangeCalendar({
  checkIn,
  checkOut,
  onChange,
}: BookingStayRangeCalendarProps) {
  const start = checkIn?.substring(0, 10) || "";
  const end = checkOut?.substring(0, 10) || "";
  const initial = parseIso(start) || new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  useEffect(() => {
    const d = parseIso(start) || parseIso(end);
    if (!d) return;
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [start, end]);

  const monthLabel = formatMonthYearLabel(new Date(viewYear, viewMonth, 1));

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const pad = (first.getDay() + 6) % 7;
    const items: Array<{ date: Date; iso: string } | null> = [];
    for (let i = 0; i < pad; i++) items.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(viewYear, viewMonth, day, 12, 0, 0, 0);
      items.push({ date, iso: formatDateKey(date) });
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
    // Complete range → start a new selection from this day
    if (start && end && start !== end) {
      onChange(iso, "");
      return;
    }
    // Only check-in picked → set check-out (must be after check-in)
    if (start && !end) {
      if (iso === start) {
        onChange(iso, isoPlusDays(iso, 1));
        return;
      }
      if (iso < start) {
        onChange(iso, "");
        return;
      }
      onChange(start, iso);
      return;
    }
    // Fresh pick
    onChange(iso, "");
  };

  const rangeHint =
    start && end
      ? `Заїзд ${start.split("-").reverse().join(".")} → виїзд ${end.split("-").reverse().join(".")}`
      : start
        ? `Заїзд ${start.split("-").reverse().join(".")} — оберіть дату виїзду`
        : "Оберіть дату заїзду, потім дату виїзду";

  return (
    <div className="price-range-calendar booking-stay-calendar">
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
            return (
              <div
                key={`empty-${idx}`}
                className="price-range-calendar__cell price-range-calendar__cell--empty"
              />
            );
          }

          const { iso, date } = cell;
          const dow = date.getDay();
          const weekend = dow === 0 || dow === 5 || dow === 6;
          const inRange = isInStayRange(iso, start, end);
          const edge = rangeEdge(iso, start, end);
          const isSingle = Boolean(start && !end && iso === start);
          const isCompleteSingle =
            Boolean(start && end && start === end && iso === start);

          const classNames = [
            "price-range-calendar__cell",
            "price-range-calendar__cell--day",
            weekend ? "price-range-calendar__cell--weekend" : "",
            inRange && !isCompleteSingle ? "price-range-calendar__cell--in-range" : "",
            edge === "start" && end && start !== end
              ? "price-range-calendar__cell--range-start"
              : "",
            edge === "end" && end && start !== end
              ? "price-range-calendar__cell--range-end"
              : "",
            isSingle || isCompleteSingle ? "price-range-calendar__cell--single" : "",
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
            </button>
          );
        })}
      </div>

      <p className="price-range-calendar__hint">{rangeHint}</p>
    </div>
  );
}
