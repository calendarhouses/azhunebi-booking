"use client";

import { nightWord } from "@/components/admin/desktop/adminPlural";
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

  const rows: { key: string; label: string; value: string; discount?: boolean }[] = [
    {
      key: "stay",
      label: `Проживання · ${price.nights} ${nightWord(price.nights)}`,
      value: `${formatPriceUa(price.basePrice)} грн`,
    },
  ];
  if (price.extraGuestFee > 0) {
    rows.push({
      key: "extra-guests",
      label: "Додаткові гості",
      value: `${formatPriceUa(price.extraGuestFee)} грн`,
    });
  }
  for (const line of price.serviceLines) {
    if (line.pendingApproval) {
      rows.push({ key: `svc-${line.id}`, label: line.name, value: "Очікує підтвердження" });
    } else if (line.onSite) {
      rows.push({ key: `svc-${line.id}`, label: line.name, value: "Оплата на місці" });
    } else if (line.fee > 0) {
      rows.push({
        key: `svc-${line.id}`,
        label: line.quantity && line.quantity > 1 ? `${line.name} × ${line.quantity}` : line.name,
        value: `${formatPriceUa(line.fee)} грн`,
      });
    }
  }
  if (price.serviceLines.length === 0 && price.petFee > 0) {
    rows.push({ key: "pet", label: "Домашня тварина", value: `${formatPriceUa(price.petFee)} грн` });
  }
  if (price.serviceLines.length === 0 && price.dayGuestFee > 0) {
    rows.push({ key: "day-guests", label: "Денні гості", value: `${formatPriceUa(price.dayGuestFee)} грн` });
  }
  if (price.earlyFee > 0) {
    rows.push({ key: "early", label: "Ранній заїзд", value: `${formatPriceUa(price.earlyFee)} грн` });
  }
  if (price.lateFee > 0) {
    rows.push({ key: "late", label: "Пізній виїзд", value: `${formatPriceUa(price.lateFee)} грн` });
  }
  if (price.discountLines.length > 0) {
    for (const line of price.discountLines) {
      rows.push({
        key: `disc-${line.label}`,
        label: line.label,
        value: `−${formatPriceUa(line.amount)} грн`,
        discount: true,
      });
    }
  } else if (price.discountAmount > 0) {
    rows.push({
      key: "disc-fallback",
      label: "Знижка",
      value: `−${formatPriceUa(price.discountAmount)} грн`,
      discount: true,
    });
  }

  return (
    <>
      <div className="dates-display">
        <div>
          <div className="dates-display-dates">
            {inD} — {outD}
          </div>
          <div className="dates-display-nights">
            {price.nights} {nightWord(price.nights)}
          </div>
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
            key={row.key}
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 12,
              fontSize: 14,
              color: row.discount ? "var(--danger)" : "var(--text)",
            }}
          >
            <span>{row.label}</span>
            <span style={{ fontWeight: 600, color: row.discount ? "var(--danger)" : undefined }}>
              {row.value}
            </span>
          </div>
        ))}
        {price.prepayment > 0 ? (
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
              {price.prepaymentLabel}
              <br />
              <span style={{ fontSize: 11, fontWeight: 400, color: "#9CA3AF" }}>
                Для підтвердження броні
              </span>
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#1A1A1A" }}>
              {formatPriceUa(price.prepayment)} грн
            </span>
          </div>
        ) : null}
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
