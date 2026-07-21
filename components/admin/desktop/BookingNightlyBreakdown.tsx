"use client";

import { useMemo } from "react";
import { getDayPrice } from "./bookingPriceEngine";
import { formatDateKey } from "./bookingUtils";
import { parseSafeDate } from "./adminDates";
import type { AdminSettingsPayload, RoomConfig } from "./types";

export type NightlyPriceLine = {
  dateKey: string;
  label: string;
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
    // Match getDayPrice weekend (Sat–Sun); placeholder Fri–Sat when no room yet
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

  return (
    <div className="booking-nightly-breakdown">
      <div className="booking-nightly-breakdown__title">Розбивка по ночах</div>
      <ul className="booking-nightly-breakdown__list">
        {lines.map((line) => (
          <li
            key={line.dateKey}
            className={`booking-nightly-breakdown__row${
              line.isWeekend ? " booking-nightly-breakdown__row--weekend" : ""
            }`}
          >
            <span className="booking-nightly-breakdown__date">{line.label}</span>
            <span className="booking-nightly-breakdown__price">
              {Math.round(line.price).toLocaleString("uk-UA")} грн
            </span>
          </li>
        ))}
      </ul>
      <div className="booking-nightly-breakdown__total">
        <span>Загальна сума</span>
        <strong>{Math.round(total).toLocaleString("uk-UA")} грн</strong>
      </div>
    </div>
  );
}
