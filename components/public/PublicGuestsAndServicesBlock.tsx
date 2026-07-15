"use client";

import type { CustomServiceConfig } from "@/components/admin/desktop/types";
import {
  formatServicePriceHint,
  getServiceQty,
  serviceInputType,
  serviceIsHourly,
  type ServiceSelectionMap,
} from "@/components/admin/desktop/settings/additionalServicesLogic";

type Props = {
  adults: number;
  children: number;
  maxOccupants: number;
  showChildren: boolean;
  availableServices: CustomServiceConfig[];
  selectedServices: ServiceSelectionMap;
  onChangeAdults: (delta: number) => void;
  onChangeChildren: (delta: number) => void;
  onSetServiceQty: (serviceId: number, qty: number) => void;
};

function ServiceToggle({
  active,
  onSelect,
}: {
  active: boolean;
  onSelect: (qty: number) => void;
}) {
  return (
    <div
      className="pets-toggle"
      style={{ marginTop: 0, paddingTop: 0, border: "none", flex: "0 0 auto", width: 140 }}
    >
      <button
        type="button"
        className={`pet-opt ${!active ? "active" : ""}`}
        style={{ padding: 8 }}
        onClick={() => onSelect(0)}
      >
        Ні
      </button>
      <button
        type="button"
        className={`pet-opt ${active ? "active" : ""}`}
        style={{ padding: 8 }}
        onClick={() => onSelect(1)}
      >
        Так
      </button>
    </div>
  );
}

export function PublicGuestsAndServicesBlock({
  adults,
  children,
  maxOccupants,
  showChildren,
  availableServices,
  selectedServices,
  onChangeAdults,
  onChangeChildren,
  onSetServiceQty,
}: Props) {
  const maxAdults = Math.max(1, maxOccupants - children);
  const maxChildren = Math.max(0, maxOccupants - adults);

  return (
    <>
      <div className="guests-row">
        <div>
          <div className="guests-label">Дорослі</div>
        </div>
        <div className="counter-wrap">
          <button
            type="button"
            className="cnt-btn"
            disabled={adults <= 1}
            onClick={() => onChangeAdults(-1)}
          >
            −
          </button>
          <span className="cnt-val">{adults}</span>
          <button
            type="button"
            className="cnt-btn"
            disabled={adults >= maxAdults}
            onClick={() => onChangeAdults(1)}
          >
            +
          </button>
        </div>
      </div>

      {showChildren ? (
        <div
          className="guests-row"
          style={{ marginTop: 8, borderTop: "1px dashed var(--border)", paddingTop: 16 }}
        >
          <div>
            <div className="guests-label">Діти</div>
          </div>
          <div className="counter-wrap">
            <button
              type="button"
              className="cnt-btn"
              disabled={children <= 0}
              onClick={() => onChangeChildren(-1)}
            >
              −
            </button>
            <span className="cnt-val">{children}</span>
            <button
              type="button"
              className="cnt-btn"
              disabled={children >= maxChildren}
              onClick={() => onChangeChildren(1)}
            >
              +
            </button>
          </div>
        </div>
      ) : null}

      {availableServices.length > 0 ? (
        <div className="public-additional-services">
          <p className="public-additional-services__title">Додаткові послуги</p>
          {availableServices.map((service) => {
            const qty = getServiceQty(selectedServices, service.id);
            const active = qty > 0;
            const isCounter = serviceInputType(service) === "counter";
            const isHourly = serviceIsHourly(service);
            const maxQty = Math.max(1, Number(service.maxQuantity) || 10);
            const hint = service.description?.trim() || formatServicePriceHint(service);
            return (
              <div
                key={service.id}
                className={`guests-row public-additional-services__item${active ? " is-active" : ""}`}
                style={{ marginTop: 8, borderTop: "1px dashed var(--border)", paddingTop: 16 }}
              >
                <div>
                  <div className="guests-label">
                    {service.name}
                    {service.requiresApproval ? (
                      <span className="public-additional-services__badge">Запит</span>
                    ) : null}
                  </div>
                  <div className="guests-sub" style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {hint}
                    {service.requiresApproval ? " · підтверджує адміністратор" : ""}
                  </div>
                </div>
                {isCounter ? (
                  <div className="counter-wrap">
                    <button
                      type="button"
                      className="cnt-btn"
                      disabled={qty <= 0}
                      onClick={() => onSetServiceQty(service.id, Math.max(0, qty - 1))}
                    >
                      −
                    </button>
                    <span className="cnt-val">
                      {qty}
                      {isHourly ? (
                        <span className="public-additional-services__unit"> год</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="cnt-btn"
                      disabled={qty >= maxQty}
                      onClick={() => onSetServiceQty(service.id, Math.min(maxQty, qty + 1))}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <ServiceToggle active={active} onSelect={(v) => onSetServiceQty(service.id, v)} />
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
