"use client";

import {
  getDayPrice,
  getRestrictionMinNights,
} from "@/components/admin/desktop/bookingPriceEngine";
import type { RoomConfig } from "@/components/admin/desktop/types";
import { formatDateKey, getBookedRanges } from "@/lib/public-booking/bookedRanges";
import { formatPriceUa } from "@/lib/public-booking/roomHelpers";
import { usePublicBooking } from "../PublicBookingProvider";

const MONTH_NAMES = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
];

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

type Props = {
  room: RoomConfig;
  layout?: "desktop" | "mobile";
};

export function DesktopCalendar({ room, layout = "desktop" }: Props) {
  const {
    runtime,
    calBase,
    shiftCal,
    checkIn,
    checkOut,
    selectDate,
    calKey,
  } = usePublicBooking();

  if (!runtime) return null;

  const base = new Date(calBase.getFullYear(), calBase.getMonth(), 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = (base.getDay() + 6) % 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bookedRanges = getBookedRanges(runtime.bookings, room);
  const customPrices = runtime.customPrices || {};
  const restrictions = runtime.restrictions || {};

  const days: React.ReactNode[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`e-${i}`} />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    const isPast = d < today;
    let isOccupied = false;
    let clickBlocked = false;

    for (const r of bookedRanges) {
      if (d > r.start && d < r.end) {
        isOccupied = true;
        clickBlocked = true;
      }
      if (d.getTime() === r.start.getTime()) {
        isOccupied = true;
        if (r.hasEarly) clickBlocked = true;
        else if (!checkIn || (checkIn && checkOut)) clickBlocked = true;
        else if (checkIn && !checkOut && d <= checkIn) clickBlocked = true;
      }
      if (d.getTime() === r.end.getTime() && r.hasLate) {
        isOccupied = true;
        clickBlocked = true;
      }
    }

    const ds = formatDateKey(d);
    let cls = "cal-day";
    if (isPast) cls += " past";
    else if (isOccupied) cls += " booked";
    if (d.toDateString() === today.toDateString()) cls += " today";
    if (isOccupied && !clickBlocked && !isPast) cls += " turnover-selectable";
    if (checkIn && ds === formatDateKey(checkIn)) cls += " selected-start";
    if (checkOut && ds === formatDateKey(checkOut)) cls += " selected-end";
    if (checkIn && checkOut && d > checkIn && d < checkOut) cls += " in-range";

    const price = getDayPrice(room, d, customPrices);
    const minN = getRestrictionMinNights(restrictions, room.id, d);
    const clickable = !isPast && !clickBlocked;

    days.push(
      <div
        key={ds}
        className={cls}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? () => selectDate(ds) : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") selectDate(ds);
              }
            : undefined
        }
      >
        {day}
        {price > 0 ? (
          <div className="day-price">{formatPriceUa(price)}</div>
        ) : null}
        {minN > 1 && !isPast && !isOccupied ? (
          <div className="day-price" style={{ fontSize: 8, opacity: 0.7 }}>
            мін.{minN}
          </div>
        ) : null}
      </div>
    );
  }

  const header = (
    <div className="cal-header">
      <button type="button" onClick={() => shiftCal(-1)} aria-label="Попередній місяць">
        <svg viewBox="0 0 24 24">
          <path d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div className="cal-month-title" id={layout === "mobile" ? "calMonthTitle" : undefined}>
        {MONTH_NAMES[month]} {year}
      </div>
      <button type="button" onClick={() => shiftCal(1)} aria-label="Наступний місяць">
        <svg viewBox="0 0 24 24">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );

  const grid = (
    <div className="cal-grid" id={layout === "mobile" ? "calGridMobile" : undefined}>
      {WEEKDAYS.map((w) => (
        <div key={w} className="cal-day-header">
          {w}
        </div>
      ))}
      {days}
    </div>
  );

  if (layout === "mobile") {
    return (
      <div className="calendar-container" key={calKey}>
        {header}
        {grid}
      </div>
    );
  }

  return (
    <div className="cal-month" key={calKey}>
      <div
        className="cal-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 16,
          width: "100%",
        }}
      >
        <button
          type="button"
          onClick={() => shiftCal(-1)}
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            background: "#F3F0EC",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="Попередній місяць"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div
          className="cal-month-title"
          style={{
            margin: 0,
            fontSize: 20,
            flex: 1,
            textAlign: "center",
            fontFamily: "'Playfair Display', serif",
            fontWeight: 700,
          }}
        >
          {MONTH_NAMES[month]} {year}
        </div>
        <button
          type="button"
          onClick={() => shiftCal(1)}
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            background: "#F3F0EC",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="Наступний місяць"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      {grid}
    </div>
  );
}
