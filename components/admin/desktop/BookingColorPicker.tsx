"use client";

import { BOOKING_COLOR_SWATCHES, normalizeBookingCustomColor } from "@/lib/bookingCustomColor";

type BookingColorPickerProps = {
  value: string | null | undefined;
  onChange: (color: string | null) => void;
  disabled?: boolean;
};

export function BookingColorPicker({ value, onChange, disabled }: BookingColorPickerProps) {
  const active = normalizeBookingCustomColor(value);

  return (
    <div className="booking-color-picker">
      <div className="booking-color-picker__label">Колір на шаховатці</div>
      <div className="booking-color-picker__row" role="listbox" aria-label="Колір броні">
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
        {BOOKING_COLOR_SWATCHES.map((hex) => {
          const selected = active === hex;
          return (
            <button
              key={hex}
              type="button"
              className={`booking-color-picker__swatch${selected ? " is-active" : ""}`}
              style={{ backgroundColor: hex }}
              aria-label={`Колір ${hex}`}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(hex)}
            />
          );
        })}
      </div>
    </div>
  );
}
