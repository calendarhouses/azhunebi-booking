"use client";

import type { ReactNode } from "react";
import {
  getDayPrice,
  getRestrictionMinNights,
  isDateClosed,
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

type DayKind =
  | "past"
  | "closed"
  | "occupied"
  | "turnover-checkout"
  | "free";

function classifyDay(params: {
  day: Date;
  today: Date;
  ranges: ReturnType<typeof getBookedRanges>;
  checkIn: Date | null;
  checkOut: Date | null;
  closed: boolean;
}): { kind: DayKind; clickable: boolean } {
  const { day, today, ranges, checkIn, checkOut, closed } = params;
  const pickingCheckout = Boolean(checkIn && !checkOut);
  const t = day.getTime();

  if (day < today) return { kind: "past", clickable: false };
  if (closed) return { kind: "closed", clickable: false };

  let isOccupiedNight = false;
  let isNextGuestCheckIn = false;
  let nextGuestHasEarly = false;
  let prevGuestHasLate = false;

  for (const r of ranges) {
    // Occupied nights: [start, end)
    if (t >= r.start.getTime() && t < r.end.getTime()) {
      isOccupiedNight = true;
      if (t === r.start.getTime()) {
        isNextGuestCheckIn = true;
        nextGuestHasEarly = Boolean(r.hasEarly);
      }
    }
    if (t === r.end.getTime() && r.hasLate) {
      prevGuestHasLate = true;
    }
  }

  // Valid checkout on next guest's check-in day (same-day turnover)
  if (
    pickingCheckout &&
    checkIn &&
    isNextGuestCheckIn &&
    !nextGuestHasEarly &&
    day > checkIn
  ) {
    return { kind: "turnover-checkout", clickable: true };
  }

  if (isOccupiedNight || prevGuestHasLate) {
    return { kind: "occupied", clickable: false };
  }

  return { kind: "free", clickable: true };
}

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
  const closedDates = runtime.closedDates || {};

  const days: ReactNode[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`e-${i}`} />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    const ds = formatDateKey(d);
    const closed = isDateClosed(closedDates, room.id, d, restrictions);
    const { kind, clickable } = classifyDay({
      day: d,
      today,
      ranges: bookedRanges,
      checkIn,
      checkOut,
      closed,
    });

    let cls = "cal-day";
    if (kind === "past") cls += " past";
    if (kind === "closed") cls += " closed-date";
    if (kind === "occupied") cls += " booked";
    if (kind === "turnover-checkout") cls += " turnover-checkout";
    if (d.toDateString() === today.toDateString()) cls += " today";
    if (checkIn && ds === formatDateKey(checkIn)) cls += " selected-start";
    if (checkOut && ds === formatDateKey(checkOut)) cls += " selected-end";
    if (checkIn && checkOut && d > checkIn && d < checkOut) cls += " in-range";

    const price = getDayPrice(room, d, customPrices);
    const minN = getRestrictionMinNights(restrictions, room.id, d);
    const showMin =
      minN > 1 && !["past", "closed", "occupied"].includes(kind);

    days.push(
      <div
        key={ds}
        className={cls}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        title={
          kind === "turnover-checkout"
            ? "Можна виїхати в цей день (заїзд наступного гостя)"
            : kind === "occupied"
              ? "Зайнято"
              : kind === "closed"
                ? "Закрито для бронювання"
                : undefined
        }
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
        {showMin ? (
          <div className="day-price" style={{ fontSize: 8, opacity: 0.7 }}>
            мін.{minN}
          </div>
        ) : null}
      </div>
    );
  }

  const legend = (
    <div className="cal-legend" aria-hidden="true">
      <span className="cal-legend__item">
        <i className="cal-legend__swatch cal-legend__swatch--free" /> Вільні
      </span>
      <span className="cal-legend__item">
        <i className="cal-legend__swatch cal-legend__swatch--booked" /> Зайняті
      </span>
      <span className="cal-legend__item">
        <i className="cal-legend__swatch cal-legend__swatch--turnover" /> Виїзд
        ОК
      </span>
    </div>
  );

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
        {legend}
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
      {legend}
    </div>
  );
}
