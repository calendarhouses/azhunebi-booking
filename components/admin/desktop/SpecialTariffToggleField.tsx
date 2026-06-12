"use client";

import type { YesNo } from "./bookingDrawerForm";

const toggleWrapStyle = {
  margin: 0,
  width: "100%",
  display: "flex",
  padding: 4,
  background: "#F3F4F6",
  borderRadius: 12,
  height: 48,
} as const;

type SpecialTariffToggleFieldProps = {
  label: string;
  tariffId: string;
  value: YesNo;
  onChange: (value: YesNo) => void;
};

/** Такий самий вигляд, як перемикач «Чан» / «Тварини». */
export function SpecialTariffToggleField({
  label,
  tariffId,
  value,
  onChange,
}: SpecialTariffToggleFieldProps) {
  return (
    <div className="form-group">
      <label>{label}:</label>
      <div className="mode-toggle" style={toggleWrapStyle}>
        <button
          type="button"
          className={`mode-btn spec-tariff-btn${value === "Ні" ? " active" : ""}`}
          data-val="Ні"
          onClick={() => onChange("Ні")}
        >
          Ні
        </button>
        <button
          type="button"
          className={`mode-btn spec-tariff-btn${value === "Так" ? " active" : ""}`}
          data-val="Так"
          onClick={() => onChange("Так")}
        >
          Так
        </button>
      </div>
      <input
        type="hidden"
        className="admin-special-tariff-input"
        data-special-tariff-id={tariffId}
        value={value}
        readOnly
      />
    </div>
  );
}
