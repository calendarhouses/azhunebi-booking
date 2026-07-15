"use client";

import type { YesNo } from "./bookingDrawerForm";
import type { SpecialTariffToggle } from "@/lib/admin/specialTariffBooking";

type Props = {
  toggles: SpecialTariffToggle[];
  values: Record<string, YesNo>;
  onChange: (tariffId: string, value: YesNo) => void;
};

function SpecialTariffRow({
  label,
  tariffId,
  value,
  onChange,
}: {
  label: string;
  tariffId: string;
  value: YesNo;
  onChange: (value: YesNo) => void;
}) {
  const active = value === "Так";

  return (
    <div className={`booking-additional-services__item${active ? " is-active" : ""}`}>
      <div>
        <p className="booking-additional-services__name">{label}</p>
        <p className="booking-additional-services__price">Спеціальний тариф для гостя</p>
      </div>
      <div className="mode-toggle booking-additional-services__toggle">
        <button
          type="button"
          className={`mode-btn${!active ? " active" : ""}`}
          onClick={() => onChange("Ні")}
        >
          Ні
        </button>
        <button
          type="button"
          className={`mode-btn${active ? " active" : ""}`}
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

export function BookingSpecialTariffsFields({ toggles, values, onChange }: Props) {
  if (!toggles.length) return null;

  return (
    <div className="booking-additional-services" style={{ gridColumn: "1 / -1" }}>
      <p className="booking-additional-services__title">Спецтарифи</p>
      <div className="booking-additional-services__list">
        {toggles.map((toggle) => (
          <SpecialTariffRow
            key={toggle.id}
            label={toggle.label}
            tariffId={toggle.id}
            value={values[toggle.id] ?? "Ні"}
            onChange={(val) => onChange(toggle.id, val)}
          />
        ))}
      </div>
    </div>
  );
}
