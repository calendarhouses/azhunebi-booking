"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
  status?: "idle" | "valid" | "invalid";
  variant?: "admin" | "public";
};

export function BookingPromoCodeField({
  value,
  onChange,
  status = "idle",
  variant = "admin",
}: Props) {
  if (variant === "public") {
    return (
      <div className="form-field public-promo-field">
        <label>Промокод</label>
        <input
          type="text"
          value={value}
          placeholder="Введіть код знижки"
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className={`public-promo-field__input${status === "valid" ? " is-valid" : ""}${status === "invalid" ? " is-invalid" : ""}`}
          autoCapitalize="characters"
          spellCheck={false}
        />
        {status === "valid" ? (
          <span className="public-promo-field__hint public-promo-field__hint--ok">
            Промокод застосовано
          </span>
        ) : null}
        {status === "invalid" ? (
          <span className="public-promo-field__hint public-promo-field__hint--err">
            Такого промокоду немає або він не діє для цього будинку
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="booking-additional-services" style={{ gridColumn: "1 / -1" }}>
      <p className="booking-additional-services__title">Промокод</p>
      <div className={`booking-additional-services__item booking-promo-field${status === "valid" ? " is-active" : ""}`}>
        <div>
          <p className="booking-additional-services__name">Код знижки</p>
          <p className="booking-additional-services__price">
            {status === "valid"
              ? "Знижку застосовано до розрахунку"
              : status === "invalid"
                ? "Перевір код — не знайдено в активних знижках"
                : "Введи промокод, якщо гість його назвав"}
          </p>
        </div>
        <input
          type="text"
          id="adminPromoCode"
          className="booking-promo-field__input"
          value={value}
          placeholder="CODE"
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
