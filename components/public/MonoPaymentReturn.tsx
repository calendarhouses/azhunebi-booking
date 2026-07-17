"use client";

import { useEffect, useState } from "react";

type PaymentState = "checking" | "paid" | "pending" | "failed";

export function MonoPaymentReturn({ orderId }: { orderId: string }) {
  const [state, setState] = useState<PaymentState>("checking");

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    const check = async () => {
      attempt += 1;
      try {
        const response = await fetch(
          `/api/payments/monopay/status?orderId=${encodeURIComponent(orderId)}`,
          { cache: "no-store" }
        );
        const data = (await response.json()) as {
          ok?: boolean;
          paid?: boolean;
          awaiting?: boolean;
        };
        if (cancelled) return;
        if (response.ok && data.paid) {
          setState("paid");
          return;
        }
        if (response.ok && !data.awaiting) {
          setState("failed");
          return;
        }
      } catch {
        // Retry while the signed webhook is still being delivered.
      }

      if (attempt < 15 && !cancelled) {
        window.setTimeout(check, 1_500);
      } else if (!cancelled) {
        setState("pending");
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const title =
    state === "paid"
      ? "Оплату отримано!"
      : state === "failed"
        ? "Оплату не підтверджено"
        : state === "pending"
          ? "Оплата ще обробляється"
          : "Перевіряємо оплату…";

  const message =
    state === "paid"
      ? "Бронювання підтверджено автоматично."
      : state === "failed"
        ? "Спробуйте оплатити ще раз або зв’яжіться з адміністратором."
        : state === "pending"
          ? "Це може зайняти кілька хвилин. Адміністратор побачить оплату автоматично."
          : "Не закривайте сторінку — очікуємо захищене підтвердження від MonoPay.";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "sans-serif",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: 440,
          padding: 28,
          borderRadius: 16,
          background: "#fff",
          boxShadow: "0 8px 30px rgba(0,0,0,.08)",
        }}
      >
        <h1 style={{ marginTop: 0 }}>{title}</h1>
        <p>{message}</p>
        <p style={{ color: "#6b7280" }}>№ {orderId}</p>
        {state === "failed" ? (
          <a href={`/pay/${encodeURIComponent(orderId)}`} style={{ color: "#4d6826" }}>
            Повернутися до оплати
          </a>
        ) : null}
      </div>
    </main>
  );
}
