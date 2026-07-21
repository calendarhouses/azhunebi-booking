"use client";

import { BOOKING_COLOR_OPTIONS, normalizeBookingCustomColor } from "@/lib/bookingCustomColor";
import { BookingFormSectionHeading } from "./BookingFormSectionHeading";

type BookingColorPickerProps = {
  value: string | null | undefined;
  onChange: (color: string | null) => void;
  disabled?: boolean;
};

export function BookingColorPicker({ value, onChange, disabled }: BookingColorPickerProps) {
  const active = normalizeBookingCustomColor(value);

  return (
    <div className="booking-color-picker">
      <BookingFormSectionHeading compact title="Колір бронювання" />
      <div className="booking-color-picker__row" role="listbox" aria-label="Колір бронювання">
        <button
          type="button"
          className={`booking-color-picker__swatch booking-color-picker__swatch--clear${
            !active ? " is-active" : ""
          }`}
          aria-label="Скинути колір"
          aria-pressed={!active}
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          <span aria-hidden>×</span>
        </button>
        {BOOKING_COLOR_OPTIONS.map(({ card, picker }) => {
          const selected = active === card;
          return (
            <button
              key={card}
              type="button"
              className={`booking-color-picker__swatch${selected ? " is-active" : ""}`}
              style={{ backgroundColor: picker }}
              aria-label={`Колір ${card}`}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(card)}
            />
          );
        })}
      </div>
    </div>
  );
}
