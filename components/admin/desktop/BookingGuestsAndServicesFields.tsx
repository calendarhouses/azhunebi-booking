"use client";

import type { CSSProperties } from "react";
import type { CustomServiceConfig } from "./types";
import {
  getServiceQty,
  MAX_CHILD_AGE,
  serviceInputType,
  type ServiceSelectionMap,
} from "./settings/additionalServicesLogic";

const COUNTER_WRAP: CSSProperties = {
  display: "flex",
  alignItems: "center",
  background: "#F9FAFB",
  borderRadius: 12,
  border: "1px solid #D1D5DB",
  height: 48,
  overflow: "hidden",
};

const COUNTER_BTN_MINUS: CSSProperties = {
  width: 44,
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#FEF2F2",
  color: "#DC2626",
  border: "none",
  borderRight: "1px solid #FECACA",
  fontSize: 22,
  fontWeight: 600,
  cursor: "pointer",
};

const COUNTER_BTN_PLUS: CSSProperties = {
  width: 44,
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#F0FDF4",
  color: "#059669",
  border: "none",
  borderLeft: "1px solid #A7F3D0",
  fontSize: 20,
  fontWeight: 600,
  cursor: "pointer",
};

function GuestCounter({
  id,
  label,
  value,
  min,
  max,
  suffix,
  onDecrement,
  onIncrement,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max?: number;
  suffix?: string;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  const atMax = max != null && value >= max;
  return (
    <div className="form-group booking-guest-count">
      <label>{label}</label>
      <div style={COUNTER_WRAP}>
        <button type="button" onClick={onDecrement} style={COUNTER_BTN_MINUS} disabled={value <= min}>
          -
        </button>
        <input
          type="number"
          id={id}
          min={min}
          readOnly
          value={value}
          style={{
            flex: 1,
            textAlign: "center",
            background: "transparent",
            border: "none",
            fontSize: 16,
            fontWeight: 700,
            minWidth: 0,
            width: 0,
          }}
        />
        {suffix ? (
          <span style={{ paddingRight: 8, fontSize: 12, fontWeight: 650, color: "#57534e" }}>
            {suffix}
          </span>
        ) : null}
        <button type="button" onClick={onIncrement} style={COUNTER_BTN_PLUS} disabled={atMax}>
          +
        </button>
      </div>
    </div>
  );
}

function ServiceRow({
  service,
  quantity,
  onSetQty,
}: {
  service: CustomServiceConfig;
  quantity: number;
  onSetQty: (qty: number) => void;
}) {
  const active = quantity > 0;
  const isCounter = serviceInputType(service) === "counter";
  const maxQty = Math.max(1, Number(service.maxQuantity) || 10);

  return (
    <div className={`booking-additional-services__item${active ? " is-active" : ""}`}>
      <div>
        <p className="booking-additional-services__name">
          {service.name}
          {service.requiresApproval ? (
            <span className="booking-additional-services__badge">Запит</span>
          ) : null}
        </p>
      </div>
      {isCounter ? (
        <div className="booking-service-counter" style={{ ...COUNTER_WRAP, height: 40 }}>
          <button
            type="button"
            onClick={() => onSetQty(Math.max(0, quantity - 1))}
            style={{ ...COUNTER_BTN_MINUS, width: 40, fontSize: 20 }}
            disabled={quantity <= 0}
          >
            -
          </button>
          <span style={{ flex: 1, textAlign: "center", fontWeight: 700 }}>{quantity}</span>
          <button
            type="button"
            onClick={() => onSetQty(Math.min(maxQty, quantity + 1))}
            style={{ ...COUNTER_BTN_PLUS, width: 40, fontSize: 18 }}
            disabled={quantity >= maxQty}
          >
            +
          </button>
        </div>
      ) : (
        <div className="mode-toggle booking-additional-services__toggle">
          <button
            type="button"
            className={`mode-btn${!active ? " active" : ""}`}
            onClick={() => onSetQty(0)}
          >
            Ні
          </button>
          <button
            type="button"
            className={`mode-btn${active ? " active" : ""}`}
            onClick={() => onSetQty(1)}
          >
            Так
          </button>
        </div>
      )}
      <input
        type="hidden"
        className="admin-service-input"
        data-service-id={service.id}
        value={String(quantity)}
        readOnly
      />
    </div>
  );
}

/** Лічильники дорослих/дітей — один рядок під коментарем у блоці «Гість». */
export function BookingGuestOccupancyFields({
  adults,
  children,
  youngestChildAge,
  maxOccupants,
  showChildren,
  childrenPolicyMessage,
  onChangeAdults,
  onChangeChildren,
  onChangeYoungestChildAge,
}: {
  adults: number;
  children: number;
  youngestChildAge: number;
  maxOccupants: number;
  showChildren: boolean;
  childrenPolicyMessage?: string | null;
  onChangeAdults: (delta: number) => void;
  onChangeChildren: (delta: number) => void;
  onChangeYoungestChildAge: (delta: number) => void;
}) {
  const maxAdults = Math.max(1, maxOccupants - children);
  const maxChildren = Math.max(0, maxOccupants - adults);

  return (
    <>
      <div className="booking-guest-counts">
        <GuestCounter
          id="adminGuests"
          label="Дорослі:"
          value={adults}
          min={1}
          max={maxAdults}
          onDecrement={() => onChangeAdults(-1)}
          onIncrement={() => onChangeAdults(1)}
        />
        {showChildren ? (
          <GuestCounter
            id="adminChildren"
            label="Діти:"
            value={children}
            min={0}
            max={maxChildren}
            onDecrement={() => onChangeChildren(-1)}
            onIncrement={() => onChangeChildren(1)}
          />
        ) : (
          <input type="hidden" id="adminChildren" value="0" readOnly />
        )}
      </div>
      {showChildren && children > 0 ? (
        <div style={{ gridColumn: "1 / -1" }}>
          <GuestCounter
            id="adminYoungestChildAge"
            label="Наймолодшій дитині (років):"
            value={youngestChildAge}
            min={0}
            max={MAX_CHILD_AGE}
            suffix="р."
            onDecrement={() => onChangeYoungestChildAge(-1)}
            onIncrement={() => onChangeYoungestChildAge(1)}
          />
        </div>
      ) : (
        <input type="hidden" id="adminYoungestChildAge" value={String(youngestChildAge)} readOnly />
      )}
      {childrenPolicyMessage ? (
        <div
          className="form-group"
          style={{
            gridColumn: "1 / -1",
            margin: 0,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #ead7d4",
            background: "#fff5f4",
          }}
          role="alert"
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#9f1239" }}>
            Обмеження будинку
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.45, color: "#881337" }}>
            {childrenPolicyMessage}
          </p>
        </div>
      ) : null}
    </>
  );
}

/** Додаткові послуги (+ приховані legacy-поля pets/dayGuests/vat). */
export function BookingGuestsAndServicesFields({
  selectedServices,
  availableServices,
  onSetServiceQty,
}: {
  selectedServices: ServiceSelectionMap;
  availableServices: CustomServiceConfig[];
  onSetServiceQty: (serviceId: number, qty: number) => void;
}) {
  return (
    <>
      <input type="hidden" id="adminPets" value="Ні" readOnly />
      <input type="hidden" id="adminDayGuests" value="0" readOnly />
      <input type="hidden" id="adminVat" value="Ні" readOnly />

      {availableServices.length > 0 ? (
        <div className="booking-additional-services" style={{ gridColumn: "1 / -1" }}>
          <p className="booking-additional-services__title">Додаткові послуги</p>
          <div className="booking-additional-services__list">
            {availableServices.map((service) => (
              <ServiceRow
                key={service.id}
                service={service}
                quantity={getServiceQty(selectedServices, service.id)}
                onSetQty={(qty) => onSetServiceQty(service.id, qty)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
