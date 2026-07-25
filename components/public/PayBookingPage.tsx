"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  abandonMonoPartsOrder,
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
  brandName: string;
  brandLogoUrl?: string | null;
  debitTestAmountUah?: number | null;
  partsTestAmountUah?: number | null;
};

type Mode = "choose" | "parts_waiting";
type AmountKind = "prepay" | "full";
type Submitting =
  | "debit-prepay"
  | "debit-full"
  | "parts-prepay"
  | "parts-full"
  | null;

type AlertState = {
  tone: "danger" | "warn";
  title: string;
  text: string;
} | null;

function third(amount: number): number {
  return amount > 0 ? Math.round((amount / 3) * 100) / 100 : 0;
}

function formatUah(amount: number): string {
  return `${amount.toLocaleString("uk-UA")} грн`;
}

/** MonoPay mark */
function LogoMono() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/images/mono/logomono.jpg" alt="" width={48} height={48} />
  );
}

/** Покупка частинами — лапка */
function LogoParts() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/images/mono/lapkamono.png" alt="" width={48} height={48} />
  );
}

function IconShield() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 5 6v6c0 5 3.2 8.4 7 9 3.8-.6 7-4 7-9V6l-7-3z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 8v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1.15" fill="currentColor" />
      <path
        d="M10.2 4.8 2.8 18a2 2 0 0 0 1.8 3h14.8a2 2 0 0 0 1.8-3L13.8 4.8a2 2 0 0 0-3.6 0z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PayBookingPage({
  orderId,
  cottage,
  checkInLabel,
  checkOutLabel,
  prepayAmount,
  totalPrice,
  partsEnabled,
  brandName,
  brandLogoUrl = null,
  debitTestAmountUah = null,
  partsTestAmountUah = null,
}: PayBookingPageProps) {
  const [mode, setMode] = useState<Mode>("choose");
  const [partsKind, setPartsKind] = useState<AmountKind>("prepay");
  const [partsAmount, setPartsAmount] = useState(0);
  const [submitting, setSubmitting] = useState<Submitting>(null);
  const [alert, setAlert] = useState<AlertState>(null);
  const [partsHint, setPartsHint] = useState(
    "Відкрийте застосунок Monobank і підтвердіть push."
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/pay-page.css";
    document.head.appendChild(link);
    // Pull-to-refresh off (older iOS Safari ignores overscroll-behavior from CSS).
    const prevHtml = document.documentElement.style.overscrollBehaviorY;
    const prevBody = document.body.style.overscrollBehaviorY;
    document.documentElement.style.overscrollBehaviorY = "none";
    document.body.style.overscrollBehaviorY = "none";
    return () => {
      link.remove();
      document.documentElement.style.overscrollBehaviorY = prevHtml;
      document.body.style.overscrollBehaviorY = prevBody;
      stopPolling();
    };
  }, [stopPolling]);

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
          setAlert({
            tone: "danger",
            title: "Monobank відхилив Покупку частинами",
            text:
              status.message ||
              "Спробуйте ще раз пізніше або оберіть оплату одразу.",
          });
          return;
        }
        if (status.waitingClient) {
          setPartsHint("Підтвердіть Покупку частинами у застосунку Monobank.");
        }
      } catch {
        // keep polling
      }
    }, 2800);
  }, [orderId, stopPolling]);

  const handleDebit = useCallback(
    async (kind: AmountKind) => {
      if (submitting) return;
      setSubmitting(kind === "prepay" ? "debit-prepay" : "debit-full");
      setAlert(null);
      try {
        const invoice = await createMonoPayment(orderId, kind);
        const pageUrl = String(invoice.pageUrl || "").trim();
        if (!/^https:\/\//i.test(pageUrl)) {
          throw new Error("MonoPay повернув некоректне посилання");
        }
        window.location.assign(pageUrl);
      } catch (err) {
        setAlert({
          tone: "danger",
          title: "Не вдалося відкрити MonoPay",
          text: err instanceof Error ? err.message : "Спробуйте ще раз за хвилину.",
        });
        setSubmitting(null);
      }
    },
    [orderId, submitting]
  );

  const handleParts = useCallback(
    async (kind: AmountKind) => {
      if (submitting) return;
      setSubmitting(kind === "prepay" ? "parts-prepay" : "parts-full");
      setAlert(null);
      try {
        const created = await createMonoPartsOrder(orderId, kind);
        setPartsKind(kind);
        setPartsAmount(created.amount);
        setMode("parts_waiting");
        setSubmitting(null);
        startPartsPolling();
      } catch (err) {
        setAlert({
          tone: "danger",
          title: "Не вдалося створити заявку",
          text:
            err instanceof Error
              ? err.message
              : "Спробуйте оплату одразу або повторіть пізніше.",
        });
        setSubmitting(null);
      }
    },
    [orderId, startPartsPolling, submitting]
  );

  const waitingAmount =
    partsAmount ||
    (partsTestAmountUah != null
      ? partsTestAmountUah
      : partsKind === "prepay"
        ? prepayAmount
        : totalPrice);
  const showFullDebit = totalPrice >= 2 && totalPrice !== prepayAmount;
  const showPrepayParts = partsEnabled && (partsTestAmountUah != null || prepayAmount >= 2);
  const showFullParts =
    partsEnabled &&
    (partsTestAmountUah != null || (totalPrice >= 2 && totalPrice !== prepayAmount));
  const debitPrepayLabel = debitTestAmountUah ?? prepayAmount;
  const debitFullLabel = debitTestAmountUah ?? totalPrice;
  const partsPrepayLabel = partsTestAmountUah ?? prepayAmount;
  const partsFullLabel = partsTestAmountUah ?? totalPrice;
  const logoSrc = brandLogoUrl || "/images/icons/house-with-hearth.svg";

  return (
    <main className="pay-page">
      <div className="pay-page__inner">
        <header className="pay-brand">
          <div className="pay-brand__logo-wrap">
            <span className="pay-brand__wave" />
            <span className="pay-brand__wave pay-brand__wave--2" />
            <span className="pay-brand__wave pay-brand__wave--3" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="pay-brand__logo" src={logoSrc} alt={brandName} />
          </div>
          <h1 className="pay-brand__title">{brandName}</h1>
          <p className="pay-brand__sub">Оплата бронювання</p>
        </header>

        <div className="pay-meta">
          <div className="pay-meta__card pay-meta__card--booking">
            <p className="pay-meta__label">Ваше бронювання</p>
            <p className="pay-meta__value">{cottage}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="pay-meta__cat"
              src="/images/mono/Cat.png"
              alt=""
              aria-hidden
            />
          </div>
          <div className="pay-meta__card">
            <div className="pay-meta__row">
              <div>
                <p className="pay-meta__label">Дати</p>
                <p className="pay-meta__dates">
                  {checkInLabel} — {checkOutLabel}
                </p>
              </div>
              <div className="pay-meta__id">№ {orderId}</div>
            </div>
          </div>
        </div>

        {mode === "parts_waiting" ? (
          <div className="pay-wait">
            <div className="pay-wait__orb">
              <LogoParts />
            </div>
            <h2>Чекаємо Monobank</h2>
            <p>{partsHint}</p>
            <p className="pay-wait__sum">
              {partsKind === "prepay" ? "Передплата" : "Повна сума"} · {formatUah(waitingAmount)} ·
              3 платежі ≈ {formatUah(third(waitingAmount))}
            </p>
            <button
              type="button"
              className="pay-ghost"
              onClick={() => {
                void (async () => {
                  stopPolling();
                  try {
                    await abandonMonoPartsOrder(orderId);
                  } catch {
                    // ignore
                  }
                  setMode("choose");
                  setAlert({
                    tone: "warn",
                    title: "Оберіть інший спосіб",
                    text: "Можна оплатити одразу через MonoPay.",
                  });
                })();
              }}
            >
              Обрати інший спосіб оплати
            </button>
          </div>
        ) : (
          <>
            <div className="pay-group">
              <p className="pay-group__title">Оплатити зараз</p>

              <button
                type="button"
                className="pay-option"
                disabled={Boolean(submitting)}
                onClick={() => void handleDebit("prepay")}
              >
                <div className="pay-option__logo">
                  <LogoMono />
                </div>
                <div>
                  <p className="pay-option__name">
                    {submitting === "debit-prepay" ? "Відкриваємо…" : "Передплата одразу"}
                  </p>
                  <p className="pay-option__hint">MonoPay · решта на місці</p>
                </div>
                <div className="pay-option__price">{formatUah(debitPrepayLabel)}</div>
              </button>

              {showFullDebit ? (
                <button
                  type="button"
                  className="pay-option"
                  disabled={Boolean(submitting)}
                  onClick={() => void handleDebit("full")}
                >
                  <div className="pay-option__logo">
                    <LogoMono />
                  </div>
                  <div>
                    <p className="pay-option__name">
                      {submitting === "debit-full" ? "Відкриваємо…" : "Повна оплата одразу"}
                    </p>
                    <p className="pay-option__hint">MonoPay · уся сума</p>
                  </div>
                  <div className="pay-option__price">{formatUah(debitFullLabel)}</div>
                </button>
              ) : null}
            </div>

            {(showPrepayParts || showFullParts) && (
              <div className="pay-group">
                <p className="pay-group__title">Покупка частинами</p>

                {showPrepayParts ? (
                  <button
                    type="button"
                    className="pay-option"
                    disabled={Boolean(submitting)}
                    onClick={() => void handleParts("prepay")}
                  >
                    <div className="pay-option__logo">
                      <LogoParts />
                    </div>
                    <div>
                      <p className="pay-option__name">
                        {submitting === "parts-prepay"
                          ? "Створюємо заявку…"
                          : "Передплата частинами"}
                      </p>
                      <p className="pay-option__hint">Підтвердження в застосунку Monobank</p>
                    </div>
                    <div className="pay-option__price">{formatUah(partsPrepayLabel)}</div>
                  </button>
                ) : null}

                {showFullParts ? (
                  <button
                    type="button"
                    className="pay-option"
                    disabled={Boolean(submitting)}
                    onClick={() => void handleParts("full")}
                  >
                    <div className="pay-option__logo">
                      <LogoParts />
                    </div>
                    <div>
                      <p className="pay-option__name">
                        {submitting === "parts-full"
                          ? "Створюємо заявку…"
                          : "Повна сума частинами"}
                      </p>
                      <p className="pay-option__hint">Підтвердження в застосунку Monobank</p>
                    </div>
                    <div className="pay-option__price">{formatUah(partsFullLabel)}</div>
                  </button>
                ) : null}
              </div>
            )}
          </>
        )}

        {alert ? (
          <div className={`pay-alert pay-alert--${alert.tone}`} role="alert">
            <div className="pay-alert__icon">
              <IconAlert />
            </div>
            <div>
              <p className="pay-alert__title">{alert.title}</p>
              <p className="pay-alert__text">{alert.text}</p>
            </div>
          </div>
        ) : null}

        <div className="pay-secure">
          <IconShield /> Захищена оплата · Mono
        </div>
      </div>
    </main>
  );
}
