"use client";

import type { CSSProperties } from "react";
import type { CustomServiceConfig } from "./types";
import {
  formatServicePriceHint,
  getServiceQty,
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
  width: 50,
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#FEF2F2",
  color: "#DC2626",
  border: "none",
  borderRight: "1px solid #FECACA",
  fontSize: 24,
  fontWeight: 600,
  cursor: "pointer",
};

const COUNTER_BTN_PLUS: CSSProperties = {
  width: 50,
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#F0FDF4",
  color: "#059669",
  border: "none",
  borderLeft: "1px solid #A7F3D0",
  fontSize: 22,
  fontWeight: 600,
  cursor: "pointer",
};

function GuestCounter({
  id,
  label,
  value,
  min,
  max,
  onDecrement,
  onIncrement,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max?: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  const atMax = max != null && value >= max;
  return (
    <div className="form-group">
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
          }}
        />
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
  const hint = service.description?.trim() || formatServicePriceHint(service);
  const pendingLabel = service.requiresApproval ? " · очікує підтвердження" : "";

  return (
    <div className={`booking-additional-services__item${active ? " is-active" : ""}`}>
      <div>
        <p className="booking-additional-services__name">
          {service.name}
          {service.requiresApproval ? (
            <span className="booking-additional-services__badge">Запит</span>
          ) : null}
        </p>
        <p className="booking-additional-services__price">
          {hint}
          {pendingLabel}
        </p>
      </div>
      {isCounter ? (
        <div style={{ ...COUNTER_WRAP, width: 140, height: 40 }}>
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

export function BookingGuestsAndServicesFields({
  adults,
  children,
  maxOccupants,
  showChildren,
  selectedServices,
  availableServices,
  onChangeAdults,
  onChangeChildren,
  onSetServiceQty,
}: {
  adults: number;
  children: number;
  maxOccupants: number;
  showChildren: boolean;
  selectedServices: ServiceSelectionMap;
  availableServices: CustomServiceConfig[];
  onChangeAdults: (delta: number) => void;
  onChangeChildren: (delta: number) => void;
  onSetServiceQty: (serviceId: number, qty: number) => void;
}) {
  const maxAdults = Math.max(1, maxOccupants - children);
  const maxChildren = Math.max(0, maxOccupants - adults);

  return (
    <>
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
