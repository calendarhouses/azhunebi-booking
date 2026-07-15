"use client";

import { useCallback, useState } from "react";
import { submitBookingReview } from "@/components/admin/desktop/adminApi";
import {
  BOOKING_STATUS_AWAITING_PAYMENT,
  BOOKING_STATUS_PENDING_REVIEW,
} from "@/lib/public-booking/bookingReview";
import { showToast } from "../desktop/adminGlobals";

type Props = {
  orderId: string;
  onApproved?: () => void;
  onRejected?: () => void;
};

export function BookingReviewActions({ orderId, onApproved, onRejected }: Props) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const run = useCallback(
    async (decision: "approve" | "reject") => {
      if (!orderId || busy) return;
      setBusy(decision);
      try {
        const result = await submitBookingReview({ orderId, decision });
        if (!result.ok) {
          const reasonText =
            result.reason === "not_found"
              ? "Бронь не знайдено"
              : result.reason === "unauthorized"
                ? "Немає доступу (перезадеплой GAS або перевір секрет)"
                : result.reason || "Не вдалося оновити заявку";
          showToast(reasonText);
          return;
        }
        if (decision === "approve") {
          showToast(result.smsLine || "Заявку прийнято");
          onApproved?.();
        } else {
          showToast("Заявку відхилено");
          onRejected?.();
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Помилка");
      } finally {
        setBusy(null);
      }
    },
    [busy, onApproved, onRejected, orderId]
  );

  return (
    <div
      className="form-section"
      style={{
        marginTop: 8,
        padding: 16,
        borderRadius: 12,
        border: "1px dashed #FCD34D",
        background: "#FFFBEB",
      }}
    >
      <p style={{ fontSize: 13, color: "#92400E", margin: "0 0 12px", lineHeight: 1.5 }}>
        Заявка <strong>{orderId}</strong> очікує підтвердження. Після «Прийняти» гостю
        автоматично піде SMS з посиланням на оплату.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          className="btn-action"
          disabled={Boolean(busy)}
          onClick={() => void run("approve")}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #86EFAC",
            background: "#DCFCE7",
            color: "#047857",
            fontWeight: 600,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy === "approve" ? "Обробка…" : "✅ Прийняти"}
        </button>
        <button
          type="button"
          className="btn-action"
          disabled={Boolean(busy)}
          onClick={() => void run("reject")}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #FECACA",
            background: "#FEE2E2",
            color: "#B91C1C",
            fontWeight: 600,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy === "reject" ? "Обробка…" : "❌ Відхилити"}
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#A16207", margin: "10px 0 0" }}>
        Статус: {BOOKING_STATUS_PENDING_REVIEW}
      </p>
    </div>
  );
}

export { BOOKING_STATUS_AWAITING_PAYMENT };
