"use client";

import { formatDateKey, isListSearchDateAvailable } from "@/lib/public-booking/bookedRanges";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  usePublicBooking,
  type StayDatePickIntent,
} from "./PublicBookingProvider";
import { useCalendarMonthSwipe } from "./useCalendarMonthSwipe";

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

const MONTH_SHORT = [
  "січ.",
  "лют.",
  "бер.",
  "квіт.",
  "трав.",
  "черв.",
  "лип.",
  "серп.",
  "вер.",
  "жовт.",
  "лист.",
  "груд.",
];

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

function formatChipDate(date: Date | null): string {
  if (!date) return "дата";
  return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
}

function monthTitle(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

function StayRangeCalendar({
  months = 1,
  pickIntent = null,
  onPick,
}: {
  months?: number;
  pickIntent?: StayDatePickIntent | null;
  onPick: (ds: string) => void;
}) {
  const {
    calBase,
    shiftCal,
    checkIn,
    checkOut,
    calKey,
    runtime,
    guestCount,
    childCount,
    youngestChildAge,
  } = usePublicBooking();
  const { onTouchStart, onTouchEnd } = useCalendarMonthSwipe(shiftCal);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rooms = runtime?.rooms || [];
  const availabilityOpts = {
    checkIn: pickIntent === "checkOut" ? checkIn : pickIntent === "checkIn" ? null : checkIn,
    checkOut: pickIntent ? null : checkOut,
    adults: guestCount,
    children: childCount,
    youngestAge: childCount > 0 ? youngestChildAge : null,
    bookings: runtime?.bookings || [],
    closedDates: runtime?.closedDates,
    restrictions: runtime?.restrictions,
  };

  const monthBlocks: ReactNode[] = [];
  for (let offset = 0; offset < months; offset += 1) {
    const base = new Date(calBase.getFullYear(), calBase.getMonth() + offset, 1);
    const year = base.getFullYear();
    const month = base.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = (base.getDay() + 6) % 7;

    const days: ReactNode[] = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`e-${offset}-${i}`} className="stay-cal-day stay-cal-day--empty" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      d.setHours(0, 0, 0, 0);
      const ds = formatDateKey(d);
      const isPast = d < today;
      const isAvailable =
        !isPast &&
        Boolean(runtime) &&
        isListSearchDateAvailable(d, rooms, availabilityOpts);
      let cls = "stay-cal-day";
      if (isPast) cls += " is-past";
      else if (!isAvailable) cls += " is-blocked";
      if (d.toDateString() === today.toDateString()) cls += " is-today";
      if (checkIn && ds === formatDateKey(checkIn)) cls += " is-start";
      if (checkOut && ds === formatDateKey(checkOut)) cls += " is-end";
      if (checkIn && checkOut && d > checkIn && d < checkOut) cls += " is-in-range";
      if (pickIntent === "checkIn" && checkIn && ds === formatDateKey(checkIn)) cls += " is-picking";
      if (pickIntent === "checkOut" && checkOut && ds === formatDateKey(checkOut)) cls += " is-picking";

      days.push(
        <button
          key={ds}
          type="button"
          className={cls}
          disabled={isPast || !isAvailable}
          onClick={() => onPick(ds)}
        >
          {day}
        </button>
      );
    }

    monthBlocks.push(
      <div key={`${year}-${month}`} className="stay-cal__month">
        <div className="stay-cal__weekdays">
          {WEEKDAYS.map((w) => (
            <span key={`${year}-${month}-${w}`}>{w}</span>
          ))}
        </div>
        <div className="stay-cal__grid">{days}</div>
      </div>
    );
  }

  const first = new Date(calBase.getFullYear(), calBase.getMonth(), 1);
  const last = new Date(calBase.getFullYear(), calBase.getMonth() + months - 1, 1);
  const headerTitle =
    months === 1
      ? monthTitle(first.getFullYear(), first.getMonth())
      : first.getFullYear() === last.getFullYear()
        ? `${MONTH_NAMES[first.getMonth()]} — ${MONTH_NAMES[last.getMonth()]} ${first.getFullYear()}`
        : `${monthTitle(first.getFullYear(), first.getMonth())} — ${monthTitle(last.getFullYear(), last.getMonth())}`;

  return (
    <div
      className={`stay-cal${months > 1 ? " stay-cal--dual" : ""}`}
      key={calKey}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="stay-cal__header">
        <button
          type="button"
          className="stay-cal__nav"
          onClick={() => shiftCal(-1)}
          aria-label="Попередній місяць"
        >
          ‹
        </button>
        <div className="stay-cal__title">{headerTitle}</div>
        <button
          type="button"
          className="stay-cal__nav"
          onClick={() => shiftCal(1)}
          aria-label="Наступний місяць"
        >
          ›
        </button>
      </div>
      <div className="stay-cal__months">{monthBlocks}</div>
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
    youngestChildAge,
    changeGuests,
    changeChildren,
    changeYoungestChildAge,
    clearStayDates,
    filteredRooms,
    listFilterActive,
    listGuestMax,
    selectStayDate,
  } = usePublicBooking();

  const [pickIntent, setPickIntent] = useState<StayDatePickIntent | null>(null);
  const focusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickIntent) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    focusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickIntent(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [pickIntent]);

  const startPick = (intent: StayDatePickIntent) => {
    setPickIntent((current) => (current === intent ? null : intent));
  };

  const handleCalendarPick = (ds: string) => {
    const result = selectStayDate(ds, pickIntent || undefined);
    if (!pickIntent) return;
    if (result === "blocked") return;
    if (pickIntent === "checkIn" && result === "set-check-in") {
      setPickIntent(null);
      return;
    }
    if (pickIntent === "checkOut" && result === "set-check-out") {
      setPickIntent(null);
      return;
    }
    if (pickIntent === "checkOut" && result === "set-check-in") {
      setPickIntent("checkOut");
    }
  };

  const availableLabel = listFilterActive
    ? filteredRooms.length === 1
      ? "1 вільний"
      : `${filteredRooms.length} вільних`
    : null;

  const guests = (
    <>
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

      {childCount > 0 ? (
        <div className="stay-filter__field stay-filter__field--guests stay-filter__field--age">
          <span className="stay-filter__field-label">Наймолодшій</span>
          <div className="stay-filter__stepper">
            <button
              type="button"
              className="stay-filter__step"
              aria-label="Менший вік"
              onClick={() => changeYoungestChildAge(-1)}
              disabled={youngestChildAge <= 0}
            >
              −
            </button>
            <span className="stay-filter__step-value">
              {youngestChildAge}
              <span className="stay-filter__age-unit"> р.</span>
            </span>
            <button
              type="button"
              className="stay-filter__step"
              aria-label="Більший вік"
              onClick={() => changeYoungestChildAge(1)}
              disabled={youngestChildAge >= 17}
            >
              +
            </button>
          </div>
        </div>
      ) : null}
    </>
  );

  const pickHint =
    pickIntent === "checkIn"
      ? "Оберіть дату заїзду"
      : pickIntent === "checkOut"
        ? checkIn
          ? "Оберіть дату виїзду"
          : "Спочатку оберіть заїзд"
        : null;

  return (
    <div
      className={`stay-filter stay-filter--${layout} stay-filter--inline${pickIntent ? " stay-filter--picking" : ""}`}
    >
      {pickIntent ? (
        <button
          type="button"
          className="stay-filter__scrim"
          aria-label="Закрити вибір дат"
          onClick={() => setPickIntent(null)}
        />
      ) : null}

      {layout === "desktop" ? (
        <h2 className="stay-filter__heading">Оберіть дату заїзду — покажемо вільні будинки</h2>
      ) : null}

      <div className="stay-filter__card">
        <div className="stay-filter__focus" ref={focusRef}>
          <div className="stay-filter__date-row">
            <button
              type="button"
              className={`stay-filter__date-chip${checkIn ? " has-value" : ""}${pickIntent === "checkIn" ? " is-active" : ""}`}
              onClick={() => startPick("checkIn")}
            >
              <span className="stay-filter__date-chip-label">Заїзд</span>
              <span className="stay-filter__date-chip-value">{formatChipDate(checkIn)}</span>
            </button>
            <button
              type="button"
              className={`stay-filter__date-chip${checkOut ? " has-value" : ""}${pickIntent === "checkOut" ? " is-active" : ""}`}
              onClick={() => startPick("checkOut")}
            >
              <span className="stay-filter__date-chip-label">Виїзд</span>
              <span className="stay-filter__date-chip-value">{formatChipDate(checkOut)}</span>
            </button>
          </div>

          {pickHint ? <p className="stay-filter__pick-hint">{pickHint}</p> : null}

          <StayRangeCalendar
            months={layout === "desktop" ? 2 : 1}
            pickIntent={pickIntent}
            onPick={handleCalendarPick}
          />
        </div>

        <div className="stay-filter__aside stay-filter__aside--tools">
          {availableLabel ? (
            <button
              type="button"
              className="stay-filter__count"
              onClick={() => {
                document
                  .getElementById("cabinsContainer")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {availableLabel}
            </button>
          ) : null}
          {listFilterActive || checkIn ? (
            <button type="button" className="stay-filter__clear" onClick={() => {
              setPickIntent(null);
              clearStayDates();
            }}>
              Скинути
            </button>
          ) : null}
        </div>

        <div className="stay-filter__bar" role="search">
          {guests}
        </div>
      </div>
    </div>
  );
}

export function PublicCabinsEmptyState() {
  const { clearStayDates, childCount, changeChildren } = usePublicBooking();
  const hasKids = childCount > 0;
  return (
    <div className="stay-empty">
      <p className="stay-empty__eyebrow">Немає вільних будинків</p>
      <h3 className="stay-empty__title">
        {hasKids ? "Немає будинків під цей склад гостей" : "На ці дати всі котеджі зайняті"}
      </h3>
      <p className="stay-empty__text">
        {hasKids
          ? "Спробуйте змінити вік наймолодшої дитини, кількість дітей або дати — можливо, знайдеться варіант поруч."
          : "Спробуйте інші дати або змініть кількість гостей — можливо, знайдеться варіант поруч."}
      </p>
      <button
        type="button"
        className="stay-empty__btn"
        onClick={() => {
          if (hasKids) changeChildren(-childCount);
          clearStayDates();
        }}
      >
        {hasKids ? "Скинути дітей і дати" : "Змінити дати"}
      </button>
    </div>
  );
}
