"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createMonoPartsOrder,
  createMonoPayment,
  pollMonoPartsStatus,
} from "@/lib/public-booking/publicApiClient";

type PayBookingPageProps = {
  orderId: string;
  cottage: string;
  checkInLabel: string;
  checkOutLabel: string;
  prepayAmount: number;
  totalPrice: number;
  partsEnabled: boolean;
};

type Mode = "choose" | "parts_waiting";
type PartsKind = "prepay" | "full";
type Submitting = "debit" | "parts-prepay" | "parts-full" | null;

function third(amount: number): number {
  return amount > 0 ? Math.round((amount / 3) * 100) / 100 : 0;
}

export function PayBookingPage({
  orderId,
  cottage,
  checkInLabel,
  checkOutLabel,
  prepayAmount,
  totalPrice,
  partsEnabled,
}: PayBookingPageProps) {
  const [mode, setMode] = useState<Mode>("choose");
  const [partsKind, setPartsKind] = useState<PartsKind>("prepay");
  const [partsAmount, setPartsAmount] = useState(0);
  const [submitting, setSubmitting] = useState<Submitting>(null);
  const [error, setError] = useState<string | null>(null);
  const [partsHint, setPartsHint] = useState(
    "Підтвердіть заявку в застосунку Monobank — ми очікуємо відповідь."
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPartsPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const status = await pollMonoPartsStatus(orderId);
        if (status.paid) {
          stopPolling();
          window.location.assign(
            `/?payment=return&orderId=${encodeURIComponent(orderId)}`
          );
          return;
        }
        if (status.failed) {
          stopPolling();
          setMode("choose");
          setSubmitting(null);
          setError(status.message || "Заявку Покупки частинами відхилено");
          return;
        }
        if (status.waitingClient) {
          setPartsHint(
            "Відкрийте Monobank і підтвердіть Покупку частинами (push-сповіщення)."
          );
        }
      } catch {
        // Keep waiting — callback / next poll may succeed.
      }
    }, 3000);
  }, [orderId, stopPolling]);

  const handleMonoPay = useCallback(async () => {
    if (submitting) return;
    setSubmitting("debit");
    setError(null);
    try {
      const invoice = await createMonoPayment(orderId);
      const pageUrl = String(invoice.pageUrl || "").trim();
      if (!/^https:\/\//i.test(pageUrl)) {
        throw new Error("MonoPay повернув некоректне посилання на оплату");
      }
      window.location.assign(pageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося відкрити MonoPay");
      setSubmitting(null);
    }
  }, [orderId, submitting]);

  const handleParts = useCallback(
    async (kind: PartsKind) => {
      if (submitting) return;
      setSubmitting(kind === "prepay" ? "parts-prepay" : "parts-full");
      setError(null);
      try {
        const created = await createMonoPartsOrder(orderId, kind);
        setPartsKind(kind);
        setPartsAmount(created.amount);
        setMode("parts_waiting");
        setSubmitting(null);
        startPartsPolling();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Не вдалося створити заявку Покупки частинами"
        );
        setSubmitting(null);
      }
    },
    [orderId, startPartsPolling, submitting]
  );

  const prepayPart = third(prepayAmount);
  const fullPart = third(totalPrice);
  const waitingAmount = partsAmount || (partsKind === "prepay" ? prepayAmount : totalPrice);
  const waitingPart = third(waitingAmount);
  const showFullParts = partsEnabled && totalPrice >= 2 && totalPrice !== prepayAmount;
  const showPrepayParts = partsEnabled && prepayAmount >= 2;

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
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>№ {orderId}</div>

        {mode === "parts_waiting" ? (
          <div
            style={{
              background: "#eff6ff",
              borderRadius: 12,
              padding: 16,
              marginBottom: 8,
              border: "1px solid #bfdbfe",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
              Очікуємо підтвердження в Monobank
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "#1e3a8a", lineHeight: 1.45 }}>
              {partsHint}
            </p>
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "#64748b" }}>
              {partsKind === "prepay" ? "Передплата" : "Повна сума"}:{" "}
              {waitingAmount.toLocaleString("uk-UA")} грн · 3 платежі
              {waitingPart > 0
                ? ` ≈ ${waitingPart.toLocaleString("uk-UA")} грн`
                : ""}
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={handleMonoPay}
              disabled={Boolean(submitting)}
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
                opacity: submitting && submitting !== "debit" ? 0.55 : submitting ? 0.7 : 1,
                textAlign: "left",
              }}
            >
              <div>
                {submitting === "debit" ? "Відкриваємо MonoPay…" : "Передплата через MonoPay"}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.9, marginTop: 4 }}>
                {prepayAmount.toLocaleString("uk-UA")} грн одразу · решта на місці
              </div>
            </button>

            {showPrepayParts ? (
              <button
                type="button"
                onClick={() => void handleParts("prepay")}
                disabled={Boolean(submitting)}
                style={{
                  width: "100%",
                  border: "1px solid #d1d5db",
                  borderRadius: 12,
                  padding: "14px 16px",
                  marginTop: 12,
                  fontSize: 16,
                  fontWeight: 600,
                  background: "#fff",
                  color: "#111827",
                  cursor: submitting ? "wait" : "pointer",
                  opacity:
                    submitting && submitting !== "parts-prepay" ? 0.55 : submitting ? 0.7 : 1,
                  textAlign: "left",
                }}
              >
                <div>
                  {submitting === "parts-prepay"
                    ? "Створюємо заявку…"
                    : "Передплата частинами (Monobank)"}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#6b7280", marginTop: 4 }}>
                  {prepayAmount.toLocaleString("uk-UA")} грн · 3 платежі
                  {prepayPart > 0 ? ` ≈ ${prepayPart.toLocaleString("uk-UA")} грн` : ""}
                  {" · "}
                  решта на місці
                </div>
              </button>
            ) : null}

            {showFullParts ? (
              <button
                type="button"
                onClick={() => void handleParts("full")}
                disabled={Boolean(submitting)}
                style={{
                  width: "100%",
                  border: "1px solid #d1d5db",
                  borderRadius: 12,
                  padding: "14px 16px",
                  marginTop: 12,
                  fontSize: 16,
                  fontWeight: 600,
                  background: "#fff",
                  color: "#111827",
                  cursor: submitting ? "wait" : "pointer",
                  opacity:
                    submitting && submitting !== "parts-full" ? 0.55 : submitting ? 0.7 : 1,
                  textAlign: "left",
                }}
              >
                <div>
                  {submitting === "parts-full"
                    ? "Створюємо заявку…"
                    : "Повна оплата частинами (Monobank)"}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#6b7280", marginTop: 4 }}>
                  {totalPrice.toLocaleString("uk-UA")} грн · 3 платежі
                  {fullPart > 0 ? ` ≈ ${fullPart.toLocaleString("uk-UA")} грн` : ""}
                </div>
                <div style={{ fontSize: 12, fontWeight: 400, color: "#9ca3af", marginTop: 6 }}>
                  Після підтвердження фінальну суму броні вже не змінюють у адмінці.
                </div>
              </button>
            ) : null}
          </>
        )}

        {error ? (
          <p style={{ margin: "12px 0 0", color: "#b91c1c", fontSize: 14 }}>{error}</p>
        ) : null}
      </div>
    </main>
  );
}
