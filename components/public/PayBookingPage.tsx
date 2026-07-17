"use client";

import { useCallback, useState } from "react";
import { createMonoPayment } from "@/lib/public-booking/publicApiClient";

type PayBookingPageProps = {
  orderId: string;
  cottage: string;
  checkInLabel: string;
  checkOutLabel: string;
  prepayAmount: number;
};

export function PayBookingPage({
  orderId,
  cottage,
  checkInLabel,
  checkOutLabel,
  prepayAmount,
}: PayBookingPageProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const invoice = await createMonoPayment(orderId);
      window.location.assign(invoice.pageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося відкрити MonoPay");
      setSubmitting(false);
    }
  }, [orderId, submitting]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#f8fafc",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#111827",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#fff",
          borderRadius: 16,
          padding: 28,
          boxShadow: "0 8px 30px rgba(0,0,0,.08)",
        }}
      >
        <p style={{ margin: "0 0 8px", color: "#6b7280", fontSize: 14 }}>Оплата бронювання</p>
        <h1 style={{ margin: "0 0 4px", fontSize: 24 }}>{cottage}</h1>
        <p style={{ margin: "0 0 20px", color: "#6b7280" }}>
          {checkInLabel} — {checkOutLabel}
        </p>
        <div
          style={{
            background: "#f3f4f6",
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 14, color: "#6b7280" }}>Передплата</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {prepayAmount.toLocaleString("uk-UA")} грн
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>
            № {orderId}
          </div>
        </div>
        <button
          type="button"
          onClick={handlePay}
          disabled={submitting}
          style={{
            width: "100%",
            border: 0,
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 16,
            fontWeight: 600,
            background: "#059669",
            color: "#fff",
            cursor: submitting ? "wait" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Відкриваємо MonoPay…" : "Оплатити через MonoPay"}
        </button>
        {error ? (
          <p style={{ margin: "12px 0 0", color: "#b91c1c", fontSize: 14 }}>{error}</p>
        ) : null}
      </div>
    </main>
  );
}
