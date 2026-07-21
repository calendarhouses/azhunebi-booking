"use client";

import { useMemo } from "react";
import { getDayPrice } from "./bookingPriceEngine";
import { formatDateKey } from "./bookingUtils";
import { parseSafeDate } from "./adminDates";
import { nightWord } from "./adminPlural";
import type { AdminSettingsPayload, RoomConfig } from "./types";

const WEEKDAY_SHORT = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"] as const;

export type NightlyPriceLine = {
  dateKey: string;
  label: string;
  weekday: string;
  price: number;
  isWeekend: boolean;
};

/** Ночі між check-in (включно) і check-out (не включно). */
export function buildNightlyPriceLines(
  checkIn: string,
  checkOut: string,
  room: RoomConfig | null | undefined,
  customPrices: AdminSettingsPayload["customPrices"]
): NightlyPriceLine[] {
  const inDate = parseSafeDate(checkIn);
  const outDate = parseSafeDate(checkOut);
  if (Number.isNaN(inDate.getTime()) || Number.isNaN(outDate.getTime())) return [];
  inDate.setHours(12, 0, 0, 0);
  outDate.setHours(12, 0, 0, 0);
  if (outDate <= inDate) return [];

  const lines: NightlyPriceLine[] = [];
  const cursor = new Date(inDate);
  while (cursor < outDate) {
    const dateKey = formatDateKey(cursor);
    const day = cursor.getDay();
    const isWeekend = room
      ? day === 0 || day === 6
      : day === 5 || day === 6;
    const price = room
      ? getDayPrice(room, cursor, customPrices)
      : isWeekend
        ? 3200
        : 2900;
    const dd = String(cursor.getDate()).padStart(2, "0");
    const mm = String(cursor.getMonth() + 1).padStart(2, "0");
    lines.push({
      dateKey,
      label: `${dd}.${mm}`,
      weekday: WEEKDAY_SHORT[day],
      price,
      isWeekend,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return lines;
}

type BookingNightlyBreakdownProps = {
  checkIn: string;
  checkOut: string;
  room: RoomConfig | null | undefined;
  customPrices?: AdminSettingsPayload["customPrices"];
};

export function BookingNightlyBreakdown({
  checkIn,
  checkOut,
  room,
  customPrices,
}: BookingNightlyBreakdownProps) {
  const lines = useMemo(
    () => buildNightlyPriceLines(checkIn, checkOut, room, customPrices),
    [checkIn, checkOut, room, customPrices]
  );

  if (lines.length === 0) return null;

  const total = lines.reduce((sum, line) => sum + line.price, 0);
  const nights = lines.length;

  return (
    <div className="booking-nightly-breakdown">
      <div className="booking-nightly-breakdown__head">
        <div className="booking-nightly-breakdown__title">Розбивка по датах</div>
        <div className="booking-nightly-breakdown__count">
          {nights} {nightWord(nights)}
        </div>
      </div>
      <ul className="booking-nightly-breakdown__list">
        {lines.map((line) => (
          <li
            key={line.dateKey}
            className={`booking-nightly-breakdown__row${
              line.isWeekend ? " booking-nightly-breakdown__row--weekend" : ""
            }`}
          >
            <span className="booking-nightly-breakdown__date-wrap">
              <span className="booking-nightly-breakdown__date">{line.label}</span>
              <span className="booking-nightly-breakdown__weekday">{line.weekday}</span>
            </span>
            <span className="booking-nightly-breakdown__price">
              {Math.round(line.price).toLocaleString("uk-UA")}
              <span className="booking-nightly-breakdown__currency"> грн</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="booking-nightly-breakdown__total">
        <span className="booking-nightly-breakdown__total-label">Загальна сума</span>
        <strong className="booking-nightly-breakdown__total-value">
          {Math.round(total).toLocaleString("uk-UA")} грн
        </strong>
      </div>
    </div>
  );
}
