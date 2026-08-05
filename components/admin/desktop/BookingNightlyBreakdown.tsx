"use client";

import { useMemo, useState } from "react";
import { getDayPrice } from "./bookingPriceEngine";
import { formatDateKey } from "./bookingUtils";
import { parseSafeDate } from "./adminDates";
import { nightWord } from "./adminPlural";
import { Percent } from "lucide-react";
import { PriceLineInput } from "../shared/PriceLineInput";
import { IntegerAmountInput } from "../shared/IntegerAmountInput";
import { BookingQuickEditDrawer } from "../mobile/BookingQuickEditDrawer";
import { useMobileUi } from "../mobile/MobileUiContext";
import type { AdminSettingsPayload, RoomConfig } from "./types";

const WEEKDAY_SHORT = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"] as const;

export type NightlyPriceLine = {
  dateKey: string;
  label: string;
  weekday: string;
  price: number;
  defaultPrice: number;
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
    // пт+сб+нд — як у сітці цін і getDayPrice
    const isWeekend = day === 0 || day === 5 || day === 6;
    const price = room
      ? getDayPrice(room, cursor, customPrices)
      : isWeekend
        ? 3200
        : 2900;
    const dd = String(cursor.getDate()).padStart(2, "0");
    const mm = String(cursor.getMonth() + 1).padStart(2, "0");
    const rounded = Math.round(price);
    lines.push({
      dateKey,
      label: `${dd}.${mm}`,
      weekday: WEEKDAY_SHORT[day],
      price: rounded,
      defaultPrice: rounded,
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
  priceOverrides?: Record<string, number>;
  onPriceChange?: (dateKey: string, price: number) => void;
  discountAmount?: number;
  discountPercent?: number;
  onDiscountAmountChange?: (value: number) => void;
  onDiscountPercentChange?: (value: number) => void;
  /**
   * `card` — окремий блок під календарем (legacy).
   * `embedded` — частина єдиного блоку «Вартість» без другої рамки й без дубля «Загальна сума».
   */
  variant?: "card" | "embedded";
  /** Показати рядок «Загальна сума» (для card за замовчуванням так, для embedded — ні). */
  showTotal?: boolean;
  /** Приховати внутрішній заголовок, якщо батько вже показує «Вартість · N ночей». */
  hideHead?: boolean;
};

export function BookingNightlyBreakdown({
  checkIn,
  checkOut,
  room,
  customPrices,
  priceOverrides = {},
  onPriceChange,
  discountAmount = 0,
  discountPercent = 0,
  onDiscountAmountChange,
  onDiscountPercentChange,
  variant = "card",
  showTotal,
  hideHead = false,
}: BookingNightlyBreakdownProps) {
  const isMobile = useMobileUi();
  const [quickEdit, setQuickEdit] = useState<{
    dateKey: string;
    title: string;
    value: number;
    defaultValue: number;
  } | null>(null);

  const defaultLines = useMemo(
    () => buildNightlyPriceLines(checkIn, checkOut, room, customPrices),
    [checkIn, checkOut, room, customPrices]
  );

  const lines = useMemo(
    () =>
      defaultLines.map((line) => ({
        ...line,
        price:
          priceOverrides[line.dateKey] !== undefined
            ? Math.max(0, Math.round(priceOverrides[line.dateKey]!))
            : line.price,
      })),
    [defaultLines, priceOverrides]
  );

  if (lines.length === 0) return null;

  const subtotal = lines.reduce((sum, line) => sum + line.price, 0);
  const safeDiscountAmount = Math.max(0, Math.round(discountAmount));
  const total = Math.max(0, subtotal - safeDiscountAmount);
  const nights = lines.length;
  const editable = Boolean(onPriceChange);
  const discountEditable = Boolean(onDiscountAmountChange || onDiscountPercentChange);
  const embedded = variant === "embedded";
  const renderTotal = showTotal ?? !embedded;

  const handlePriceChange = (dateKey: string, price: number) => {
    onPriceChange?.(dateKey, Math.max(0, Math.round(price)));
  };

  return (
    <>
      <div
        className={`booking-nightly-breakdown${
          embedded ? " booking-nightly-breakdown--embedded" : ""
        }`}
      >
        {!hideHead ? (
          <div className="booking-nightly-breakdown__head">
            <div className="booking-nightly-breakdown__title">
              {embedded ? "По ночах" : "Розбивка по датах"}
            </div>
            <div className="booking-nightly-breakdown__count">
              {nights} {nightWord(nights)}
            </div>
          </div>
        ) : null}
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
              {editable ? (
                isMobile ? (
                  <button
                    type="button"
                    className="price-edit-wrapper booking-nightly-breakdown__price-edit"
                    onClick={() =>
                      setQuickEdit({
                        dateKey: line.dateKey,
                        title: `${line.label} · ${line.weekday}`,
                        value: line.price,
                        defaultValue: line.defaultPrice,
                      })
                    }
                  >
                    <span className="editable-number">{line.price.toLocaleString("uk-UA")}</span>
                    <span className="price-edit-suffix">грн</span>
                  </button>
                ) : (
                  <div className="price-edit-wrapper booking-nightly-breakdown__price-edit">
                    <PriceLineInput
                      value={line.price}
                      onChange={(value) => handlePriceChange(line.dateKey, value)}
                      ariaLabel={`Ціна за ${line.label}`}
                    />
                    <span className="price-edit-suffix">грн</span>
                  </div>
                )
              ) : (
                <span className="booking-nightly-breakdown__price">
                  {line.price.toLocaleString("uk-UA")}
                  <span className="booking-nightly-breakdown__currency"> грн</span>
                </span>
              )}
            </li>
          ))}
        </ul>
        {discountEditable ? (
          <div className="booking-nightly-breakdown__discount">
            <div className="booking-nightly-breakdown__discount-head">
              <div className="booking-nightly-breakdown__discount-brand">
                <span className="booking-nightly-breakdown__discount-icon" aria-hidden>
                  <Percent size={15} strokeWidth={2.4} />
                </span>
                <div className="booking-nightly-breakdown__discount-copy">
                  <div className="booking-nightly-breakdown__discount-title">Знижка</div>
                </div>
              </div>
              {safeDiscountAmount > 0 ? (
                <div className="booking-nightly-breakdown__discount-chip">
                  −{safeDiscountAmount.toLocaleString("uk-UA")} грн
                </div>
              ) : null}
            </div>
            <div className="booking-nightly-breakdown__discount-grid">
              <label className="booking-nightly-breakdown__discount-field">
                <span className="booking-nightly-breakdown__discount-label">Сума</span>
                <div className="booking-nightly-breakdown__discount-control">
                  <IntegerAmountInput
                    className="booking-nightly-breakdown__discount-native"
                    value={safeDiscountAmount}
                    onValueChange={(value) =>
                      onDiscountAmountChange?.(Math.min(Math.max(0, value), subtotal))
                    }
                    aria-label="Знижка сума"
                  />
                  <span className="booking-nightly-breakdown__discount-unit">грн</span>
                </div>
              </label>
              <label className="booking-nightly-breakdown__discount-field">
                <span className="booking-nightly-breakdown__discount-label">Відсоток</span>
                <div className="booking-nightly-breakdown__discount-control">
                  <IntegerAmountInput
                    className="booking-nightly-breakdown__discount-native"
                    value={Math.max(0, Math.round(discountPercent))}
                    onValueChange={(value) =>
                      onDiscountPercentChange?.(Math.min(100, Math.max(0, value)))
                    }
                    aria-label="Знижка відсоток"
                  />
                  <span className="booking-nightly-breakdown__discount-unit">%</span>
                </div>
              </label>
            </div>
          </div>
        ) : null}
        {renderTotal ? (
          <div className="booking-nightly-breakdown__total">
            <span className="booking-nightly-breakdown__total-label">Загальна сума</span>
            <strong className="booking-nightly-breakdown__total-value">
              {Math.round(total).toLocaleString("uk-UA")} грн
            </strong>
          </div>
        ) : null}
      </div>

      {isMobile && quickEdit && onPriceChange ? (
        <BookingQuickEditDrawer
          open
          title={quickEdit.title}
          value={quickEdit.value}
          defaultValue={quickEdit.defaultValue}
          onClose={() => setQuickEdit(null)}
          onSave={(value) => {
            handlePriceChange(quickEdit.dateKey, value);
            setQuickEdit(null);
          }}
        />
      ) : null}
    </>
  );
}
