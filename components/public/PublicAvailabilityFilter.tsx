"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatDateKey } from "@/lib/public-booking/bookedRanges";
import { usePublicBooking } from "./PublicBookingProvider";

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

function formatStayLabel(checkIn: Date | null, checkOut: Date | null): string {
  if (!checkIn) return "Оберіть дати";
  const inLabel = checkIn.toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "short",
  });
  if (!checkOut) return `${inLabel} — …`;
  const outLabel = checkOut.toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "short",
  });
  return `${inLabel} — ${outLabel}`;
}

function StayRangeCalendar() {
  const { calBase, shiftCal, checkIn, checkOut, selectStayDate, calKey } =
    usePublicBooking();

  const base = new Date(calBase.getFullYear(), calBase.getMonth(), 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = (base.getDay() + 6) % 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: React.ReactNode[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`e-${i}`} className="stay-cal-day stay-cal-day--empty" />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    const ds = formatDateKey(d);
    const isPast = d < today;
    let cls = "stay-cal-day";
    if (isPast) cls += " is-past";
    if (d.toDateString() === today.toDateString()) cls += " is-today";
    if (checkIn && ds === formatDateKey(checkIn)) cls += " is-start";
    if (checkOut && ds === formatDateKey(checkOut)) cls += " is-end";
    if (checkIn && checkOut && d > checkIn && d < checkOut) cls += " is-in-range";

    days.push(
      <button
        key={ds}
        type="button"
        className={cls}
        disabled={isPast}
        onClick={() => selectStayDate(ds)}
      >
        {day}
      </button>
    );
  }

  return (
    <div className="stay-cal" key={calKey}>
      <div className="stay-cal__header">
        <button
          type="button"
          className="stay-cal__nav"
          onClick={() => shiftCal(-1)}
          aria-label="Попередній місяць"
        >
          ‹
        </button>
        <div className="stay-cal__title">
          {MONTH_NAMES[month]} {year}
        </div>
        <button
          type="button"
          className="stay-cal__nav"
          onClick={() => shiftCal(1)}
          aria-label="Наступний місяць"
        >
          ›
        </button>
      </div>
      <div className="stay-cal__weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="stay-cal__grid">{days}</div>
      <p className="stay-cal__hint">Спочатку заїзд, потім виїзд</p>
    </div>
  );
}

type Props = {
  layout?: "desktop" | "mobile";
};

export function PublicAvailabilityFilter({ layout = "desktop" }: Props) {
  const {
    checkIn,
    checkOut,
    guestCount,
    childCount,
    changeGuests,
    changeChildren,
    clearStayDates,
    filteredRooms,
    listFilterActive,
    listGuestMax,
  } = usePublicBooking();

  const [datesOpen, setDatesOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!datesOpen) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setDatesOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDatesOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [datesOpen]);

  useEffect(() => {
    if (checkIn && checkOut) setDatesOpen(false);
  }, [checkIn, checkOut]);

  const nights =
    checkIn && checkOut
      ? Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000)
      : 0;

  const availableLabel = listFilterActive
    ? filteredRooms.length === 1
      ? "1 вільний"
      : `${filteredRooms.length} вільних`
    : null;

  return (
    <div
      ref={rootRef}
      className={`stay-filter stay-filter--${layout}${datesOpen ? " is-open" : ""}`}
    >
      {layout === "desktop" ? (
        <h2 className="stay-filter__heading">
          Оберіть період — покажемо лише вільні будинки
        </h2>
      ) : null}

      <div className="stay-filter__bar" role="search">
        <button
          type="button"
          className={`stay-filter__field stay-filter__field--dates${checkIn ? " has-value" : ""}`}
          aria-expanded={datesOpen}
          aria-controls={popoverId}
          onClick={() => setDatesOpen((v) => !v)}
        >
          <span className="stay-filter__field-label">Дати</span>
          <span className="stay-filter__field-value">
            {formatStayLabel(checkIn, checkOut)}
          </span>
          {nights > 0 ? (
            <span className="stay-filter__field-meta">
              {nights}{" "}
              {nights === 1 ? "ніч" : nights < 5 ? "ночі" : "ночей"}
            </span>
          ) : null}
        </button>

        <div className="stay-filter__field stay-filter__field--guests">
          <span className="stay-filter__field-label">Дорослі</span>
          <div className="stay-filter__stepper">
            <button
              type="button"
              className="stay-filter__step"
              aria-label="Менше дорослих"
              onClick={() => changeGuests(-1)}
              disabled={guestCount <= 1}
            >
              −
            </button>
            <span className="stay-filter__step-value">{guestCount}</span>
            <button
              type="button"
              className="stay-filter__step"
              aria-label="Більше дорослих"
              onClick={() => changeGuests(1)}
              disabled={guestCount + childCount >= listGuestMax}
            >
              +
            </button>
          </div>
        </div>

        <div className="stay-filter__field stay-filter__field--guests">
          <span className="stay-filter__field-label">Діти</span>
          <div className="stay-filter__stepper">
            <button
              type="button"
              className="stay-filter__step"
              aria-label="Менше дітей"
              onClick={() => changeChildren(-1)}
              disabled={childCount <= 0}
            >
              −
            </button>
            <span className="stay-filter__step-value">{childCount}</span>
            <button
              type="button"
              className="stay-filter__step"
              aria-label="Більше дітей"
              onClick={() => changeChildren(1)}
              disabled={guestCount + childCount >= listGuestMax}
            >
              +
            </button>
          </div>
        </div>

        {(listFilterActive || checkIn) && (
          <div className="stay-filter__aside">
            {availableLabel ? (
              <span className="stay-filter__count">{availableLabel}</span>
            ) : null}
            <button
              type="button"
              className="stay-filter__clear"
              onClick={() => {
                clearStayDates();
                setDatesOpen(false);
              }}
            >
              Скинути дати
            </button>
          </div>
        )}
      </div>

      {datesOpen ? (
        <div id={popoverId} className="stay-filter__popover" role="dialog" aria-label="Календар">
          <StayRangeCalendar />
        </div>
      ) : null}
    </div>
  );
}

export function PublicCabinsEmptyState() {
  const { clearStayDates } = usePublicBooking();
  return (
    <div className="stay-empty">
      <p className="stay-empty__eyebrow">Немає вільних будинків</p>
      <h3 className="stay-empty__title">На ці дати всі котеджі зайняті</h3>
      <p className="stay-empty__text">
        Спробуйте інші дати або змініть кількість гостей — можливо, знайдеться
        варіант поруч.
      </p>
      <button type="button" className="stay-empty__btn" onClick={clearStayDates}>
        Змінити дати
      </button>
    </div>
  );
}
