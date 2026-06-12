"use client";

import { formatPriceUa } from "@/lib/public-booking/roomHelpers";
import type { PublicPriceBreakdown } from "@/lib/public-booking/types";

type Props = {
  price: PublicPriceBreakdown;
  checkIn: Date;
  checkOut: Date;
};

export function BookingCheckoutSummary({ price, checkIn, checkOut }: Props) {
  const inD = checkIn.toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
  const outD = checkOut.toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
  const pctLabel = Math.round(price.discountPercent * 100);

  const rows: { label: string; value: string; accent?: boolean }[] = [
    { label: `${price.nights} ночей · проживання`, value: `${formatPriceUa(price.basePrice)} грн` },
  ];
  if (price.extraGuestFee > 0) {
    rows.push({ label: "Додаткові гості", value: `${formatPriceUa(price.extraGuestFee)} грн` });
  }
  if (price.petFee > 0) {
    rows.push({ label: "Домашня тварина", value: `${formatPriceUa(price.petFee)} грн` });
  }
  if (price.dayGuestFee > 0) {
    rows.push({ label: "Денні гості", value: `${formatPriceUa(price.dayGuestFee)} грн` });
  }
  if (price.earlyFee > 0) {
    rows.push({ label: "Ранній заїзд", value: `${formatPriceUa(price.earlyFee)} грн` });
  }
  if (price.lateFee > 0) {
    rows.push({ label: "Пізній виїзд", value: `${formatPriceUa(price.lateFee)} грн` });
  }
  if (price.discountAmount > 0) {
    rows.push({
      label: `Знижка${pctLabel ? ` (${pctLabel}%)` : ""}`,
      value: `−${formatPriceUa(price.discountAmount)} грн`,
      accent: true,
    });
  }

  return (
    <>
      <div className="dates-display">
        <div>
          <div className="dates-display-dates">
            {inD} — {outD}
          </div>
          <div className="dates-display-nights">{price.nights} ночей</div>
        </div>
      </div>
      <div className="summary-block">
        <h3
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 20,
            letterSpacing: "-0.5px",
            color: "var(--text)",
          }}
        >
          Розрахунок вартості
        </h3>
        {rows.map((row) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 12,
              fontSize: 14,
              color: row.accent ? "var(--accent)" : "var(--text)",
            }}
          >
            <span>{row.label}</span>
            <span style={{ fontWeight: 600 }}>{row.value}</span>
          </div>
        ))}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#FFF",
            padding: 14,
            borderRadius: 12,
            border: "1px dashed var(--accent)",
            marginTop: 16,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "#4B5563" }}>
            Передплата (50%)
            <br />
            <span style={{ fontSize: 11, fontWeight: 400, color: "#9CA3AF" }}>
              Для підтвердження броні
            </span>
          </span>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#1A1A1A" }}>
            {formatPriceUa(price.prepayment)} грн
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          <span>Разом</span>
          <span>{formatPriceUa(price.totalPrice)} грн</span>
        </div>
      </div>
    </>
  );
}
