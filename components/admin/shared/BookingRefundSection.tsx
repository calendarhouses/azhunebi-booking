"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { submitBookingRefund } from "@/components/admin/desktop/adminApi";
import { resolveBookingOrderId } from "@/components/admin/desktop/bookingUtils";
import { showToast } from "@/components/admin/desktop/adminGlobals";
import { IntegerAmountInput } from "./IntegerAmountInput";
import { getBookingPayments } from "@/lib/admin/bookingPayments";
import { isMonoChastBooking } from "@/lib/monoparts/bookingKind";
import { isPendingReviewStatus } from "@/lib/public-booking/bookingReview";
import type { BookingRecord } from "@/components/admin/desktop/types";

type Props = {
  booking: BookingRecord;
  onRefunded?: () => void;
};

function money(n: number): string {
  return `${Math.round(n).toLocaleString("uk-UA")} грн`;
}

export function BookingRefundSection({ booking, onRefunded }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [partialAmount, setPartialAmount] = useState(0);
  const [cancelBooking, setCancelBooking] = useState(false);
  const [busy, setBusy] = useState(false);

  const orderId = resolveBookingOrderId(booking);
  const invoiceId = String(booking.monoInvoiceId || "").trim();

  // Only the online Mono portion is refundable via Mono (cash/ФОП excluded).
  const refundable = useMemo(() => {
    const pays = getBookingPayments(booking);
    let monoPaid = 0;
    let refundedAlready = 0;
    for (const p of pays) {
      const amt = Math.round(Number(p.amount) || 0);
      if (p.type === "refund" || amt < 0) {
        refundedAlready += Math.abs(amt);
        continue;
      }
      if (String(p.method || "").includes("Mono")) monoPaid += amt;
    }
    const net = monoPaid - refundedAlready;
    if (net > 0) return net;
    // Legacy fallback: mono invoice exists but no tagged Mono payment row.
    if (monoPaid === 0) return Math.max(0, Math.round(Number(booking.paidAmount) || 0));
    return 0;
  }, [booking]);
  const isChast = useMemo(
    () =>
      isMonoChastBooking({
        monoPageUrl: String(booking.monoPageUrl || ""),
        monoInvoiceId: invoiceId,
      }),
    [booking.monoPageUrl, invoiceId]
  );

  // Refund is only possible for online Mono payments that still have money on them.
  if (
    !orderId ||
    !invoiceId ||
    refundable <= 0 ||
    isPendingReviewStatus(String(booking.status || ""))
  ) {
    return null;
  }

  const channelLabel = isChast ? "Покупка частинами" : "MonoPay (миттєва оплата)";
  const amountToRefund =
    mode === "full" ? refundable : Math.min(Math.max(0, partialAmount), refundable);
  const canConfirm = amountToRefund > 0 && amountToRefund <= refundable && !busy;

  const openModal = () => {
    setMode("full");
    setPartialAmount(refundable);
    setCancelBooking(false);
    setOpen(true);
  };

  const runRefund = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      const result = await submitBookingRefund({
        orderId,
        amountUah: amountToRefund,
        cancelBooking,
      });
      if (!result.ok) {
        const map: Record<string, string> = {
          no_online_payment: "У броні немає онлайн-оплати Mono для повернення",
          amount_exceeds_paid: "Сума перевищує сплачену",
          mono_refund_failed: result.message || "Mono відхилив повернення",
          booking_not_found: "Бронь не знайдено",
        };
        showToast(map[result.error || ""] || result.message || "Не вдалося повернути кошти");
        return;
      }
      if (result.warning === "refund_not_journaled") {
        showToast("Гроші повернуто, але запис у журнал не додався — додайте вручну");
      } else {
        showToast(`Повернено ${money(amountToRefund)} через Mono`);
      }
      setOpen(false);
      onRefunded?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Помилка повернення");
    } finally {
      setBusy(false);
    }
  };

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="refund-modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget && !busy) setOpen(false);
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 5000,
              background: "rgba(17, 24, 39, 0.55)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              style={{
                width: "100%",
                maxWidth: 420,
                background: "#FFFFFF",
                borderRadius: 20,
                boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "20px 22px",
                  background: "linear-gradient(135deg,#111827,#374151)",
                  color: "#fff",
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 700 }}>Повернення коштів</div>
                <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 4 }}>
                  {channelLabel} · бронь {orderId}
                </div>
              </div>

              <div style={{ padding: 22 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "#F9FAFB",
                    border: "1px solid #E5E7EB",
                    marginBottom: 16,
                  }}
                >
                  <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 500 }}>
                    Сплачено онлайн
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
                    {money(refundable)}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {(["full", "partial"] as const).map((m) => {
                    const active = mode === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setMode(m);
                          if (m === "full") setPartialAmount(refundable);
                        }}
                        style={{
                          flex: 1,
                          padding: "12px 10px",
                          borderRadius: 12,
                          fontWeight: 700,
                          fontSize: 13.5,
                          cursor: "pointer",
                          border: active ? "2px solid #111827" : "1px solid #D1D5DB",
                          background: active ? "#111827" : "#fff",
                          color: active ? "#fff" : "#374151",
                          transition: "all .15s ease",
                        }}
                      >
                        {m === "full" ? "Повністю" : "Частково"}
                      </button>
                    );
                  })}
                </div>

                {mode === "partial" ? (
                  <div style={{ marginBottom: 16 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12.5,
                        color: "#6B7280",
                        fontWeight: 600,
                        marginBottom: 6,
                      }}
                    >
                      Сума повернення (грн)
                    </label>
                    <IntegerAmountInput
                      value={partialAmount}
                      onValueChange={(n) => setPartialAmount(Math.min(Math.max(0, n), refundable))}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: "1px solid #D1D5DB",
                        fontSize: 16,
                        fontWeight: 700,
                        outline: "none",
                      }}
                    />
                    <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 6 }}>
                      Максимум: {money(refundable)}
                    </div>
                  </div>
                ) : null}

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "#F9FAFB",
                    border: "1px solid #E5E7EB",
                    cursor: "pointer",
                    marginBottom: 20,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={cancelBooking}
                    onChange={(e) => setCancelBooking(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: "#DC2626" }}
                  />
                  <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
                    Скасувати бронь після повернення
                  </span>
                </label>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => !busy && setOpen(false)}
                    style={{ flex: 1, margin: 0 }}
                  >
                    Скасувати
                  </button>
                  <button
                    type="button"
                    onClick={() => void runRefund()}
                    disabled={!canConfirm}
                    style={{
                      flex: 1.4,
                      margin: 0,
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "none",
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: canConfirm ? "pointer" : "not-allowed",
                      color: "#fff",
                      background: canConfirm
                        ? "linear-gradient(135deg,#DC2626,#B91C1C)"
                        : "#F3B4B4",
                      boxShadow: canConfirm ? "0 6px 16px rgba(220,38,38,0.35)" : "none",
                    }}
                  >
                    {busy ? "Обробка…" : `Повернути ${money(amountToRefund)}`}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      className="form-section"
      style={{
        marginTop: 8,
        padding: 16,
        borderRadius: 14,
        border: "1px solid #FCA5A5",
        background: "linear-gradient(135deg,#FFF5F5,#FEF2F2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#991B1B" }}>
            Повернення коштів
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#B45309", lineHeight: 1.45 }}>
            {channelLabel} · доступно {money(refundable)}
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          style={{
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 12,
            border: "none",
            fontWeight: 700,
            fontSize: 13.5,
            cursor: "pointer",
            color: "#fff",
            background: "linear-gradient(135deg,#DC2626,#B91C1C)",
            boxShadow: "0 6px 16px rgba(220,38,38,0.3)",
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />
          </svg>
          Повернути кошти
        </button>
      </div>
      {modal}
    </div>
  );
}
