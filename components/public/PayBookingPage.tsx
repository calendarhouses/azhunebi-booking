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
  heroImageUrl?: string | null;
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
  tone: "danger" | "warn" | "info";
  title: string;
  text: string;
} | null;

function third(amount: number): number {
  return amount > 0 ? Math.round((amount / 3) * 100) / 100 : 0;
}

function formatUah(amount: number): string {
  return `${amount.toLocaleString("uk-UA")} грн`;
}

function IconBolt() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M13 2 4 14h7l-1 8 10-14h-7l0-6z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCard() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2.5" y="5" width="19" height="14" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M2.5 10h19" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconParts() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="5.5" height="16" rx="1.5" fill="currentColor" opacity="0.35" />
      <rect x="9.25" y="4" width="5.5" height="16" rx="1.5" fill="currentColor" opacity="0.65" />
      <rect x="15.5" y="4" width="5.5" height="16" rx="1.5" fill="currentColor" />
    </svg>
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
  heroImageUrl = null,
  debitTestAmountUah = null,
  partsTestAmountUah = null,
}: PayBookingPageProps) {
  const [mode, setMode] = useState<Mode>("choose");
  const [partsKind, setPartsKind] = useState<AmountKind>("prepay");
  const [partsAmount, setPartsAmount] = useState(0);
  const [submitting, setSubmitting] = useState<Submitting>(null);
  const [alert, setAlert] = useState<AlertState>(null);
  const [partsHint, setPartsHint] = useState(
    "Відкрийте застосунок Monobank і підтвердіть push — зазвичай до хвилини."
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
    return () => {
      link.remove();
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
              "Часта причина — інша незавершена заявка ПЧ (почекайте ~15 хв) або ліміт. Оберіть оплату одразу нижче.",
          });
          return;
        }
        if (status.waitingClient) {
          setPartsHint("Push уже в Monobank. Підтвердіть Покупку частинами у застосунку.");
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
          title: "Не вдалося створити заявку ПЧ",
          text:
            err instanceof Error
              ? err.message
              : "Спробуйте оплату одразу або повторіть через кілька хвилин.",
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
  const testMode = debitTestAmountUah != null || partsTestAmountUah != null;
  const logoSrc = brandLogoUrl || "/images/icons/house-with-hearth.svg";

  return (
    <main className="pay-page">
      <div className="pay-page__bg" aria-hidden>
        {heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pay-page__bg-img" src={heroImageUrl} alt="" />
        ) : null}
      </div>

      <div className="pay-page__inner">
        <header className="pay-hero">
          <div className="pay-hero__logo-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="pay-hero__logo" src={logoSrc} alt={brandName} />
          </div>
          <div className="pay-hero__mark">{brandName}</div>
          <div className="pay-hero__sub">Оплата бронювання</div>
        </header>

        <section className="pay-panel">
          <div className="pay-panel__top">
            <div>
              <p className="pay-panel__kicker">Ваше бронювання</p>
              <h1 className="pay-panel__title">{cottage}</h1>
              <p className="pay-panel__dates">
                {checkInLabel} — {checkOutLabel}
              </p>
            </div>
            <div className="pay-panel__id">№ {orderId}</div>
          </div>

          {testMode ? (
            <div className="pay-alert pay-alert--warn" role="status">
              <div className="pay-alert__icon">
                <IconAlert />
              </div>
              <div>
                <p className="pay-alert__title">Тестові суми</p>
                <p className="pay-alert__text">
                  MonoPay: {debitTestAmountUah != null ? formatUah(debitTestAmountUah) : "—"}. ПЧ:{" "}
                  {partsTestAmountUah != null ? formatUah(partsTestAmountUah) : "—"}. Після тестів
                  прибери env на Vercel.
                </p>
              </div>
            </div>
          ) : null}

          {mode === "parts_waiting" ? (
            <div className="pay-wait">
              <div className="pay-wait__orb">
                <IconParts />
              </div>
              <h2>Чекаємо Monobank</h2>
              <p>{partsHint}</p>
              <p className="pay-wait__sum">
                {partsKind === "prepay" ? "Передплата" : "Повна сума"} · {formatUah(waitingAmount)}{" "}
                · 3 платежі ≈ {formatUah(third(waitingAmount))}
              </p>
              <div className="pay-wait__actions">
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
                        text: "Можна оплатити одразу через MonoPay. Якщо в Monobank ще висить заявка — відхиліть її або зачекайте ~15 хв.",
                      });
                    })();
                  }}
                >
                  Обрати інший спосіб оплати
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="pay-group" style={{ marginTop: testMode ? 14 : 0 }}>
                <div className="pay-group__head">
                  <span>Оплатити зараз</span>
                </div>

                <button
                  type="button"
                  className="pay-method pay-method--featured"
                  style={{ animationDelay: "0.04s" }}
                  disabled={Boolean(submitting)}
                  onClick={() => void handleDebit("prepay")}
                >
                  <div className="pay-method__inner">
                    <div className="pay-method__icon">
                      <IconBolt />
                    </div>
                    <div>
                      <div className="pay-method__name">
                        {submitting === "debit-prepay" ? "Відкриваємо MonoPay…" : "Передплата одразу"}
                      </div>
                      <div className="pay-method__sub">
                        <span className="pay-mono-mark">
                          <i /> MonoPay
                        </span>{" "}
                        · решта на місці
                      </div>
                      <div className="pay-method__tags">
                        <span className="pay-tag">Visa / Mastercard</span>
                        <span className="pay-tag">Миттєво</span>
                        {debitTestAmountUah != null ? <span className="pay-tag">TEST</span> : null}
                      </div>
                    </div>
                    <div className="pay-method__price">{formatUah(debitPrepayLabel)}</div>
                  </div>
                </button>

                {showFullDebit ? (
                  <button
                    type="button"
                    className="pay-method"
                    style={{ animationDelay: "0.1s" }}
                    disabled={Boolean(submitting)}
                    onClick={() => void handleDebit("full")}
                  >
                    <div className="pay-method__inner">
                      <div className="pay-method__icon">
                        <IconCard />
                      </div>
                      <div>
                        <div className="pay-method__name">
                          {submitting === "debit-full" ? "Відкриваємо MonoPay…" : "Повна оплата одразу"}
                        </div>
                        <div className="pay-method__sub">Уся сума карткою · без розстрочки</div>
                        <div className="pay-method__tags">
                          <span className="pay-tag">1 платіж</span>
                          {debitTestAmountUah != null ? <span className="pay-tag">TEST</span> : null}
                        </div>
                      </div>
                      <div className="pay-method__price">{formatUah(debitFullLabel)}</div>
                    </div>
                  </button>
                ) : null}
              </div>

              {(showPrepayParts || showFullParts) && (
                <div className="pay-group">
                  <div className="pay-group__head">
                    <span>Покупка частинами</span>
                    <span className="pay-group__pill">
                      <IconParts /> 0% · 3 платежі
                    </span>
                  </div>

                  {showPrepayParts ? (
                    <button
                      type="button"
                      className="pay-method"
                      style={{ animationDelay: "0.16s" }}
                      disabled={Boolean(submitting)}
                      onClick={() => void handleParts("prepay")}
                    >
                      <div className="pay-method__inner">
                        <div className="pay-method__icon">
                          <IconParts />
                        </div>
                        <div>
                          <div className="pay-method__name">
                            {submitting === "parts-prepay"
                              ? "Створюємо заявку…"
                              : "Передплата частинами"}
                          </div>
                          <div className="pay-method__sub">
                            {formatUah(partsPrepayLabel)} · ≈ {formatUah(third(partsPrepayLabel))} ×
                            3 · решта на місці
                          </div>
                          <div className="pay-method__hint">Підтвердження в застосунку Monobank</div>
                        </div>
                        <div className="pay-method__price">{formatUah(partsPrepayLabel)}</div>
                      </div>
                    </button>
                  ) : null}

                  {showFullParts ? (
                    <button
                      type="button"
                      className="pay-method"
                      style={{ animationDelay: "0.22s" }}
                      disabled={Boolean(submitting)}
                      onClick={() => void handleParts("full")}
                    >
                      <div className="pay-method__inner">
                        <div className="pay-method__icon">
                          <IconParts />
                        </div>
                        <div>
                          <div className="pay-method__name">
                            {submitting === "parts-full"
                              ? "Створюємо заявку…"
                              : "Повна сума частинами"}
                          </div>
                          <div className="pay-method__sub">
                            {formatUah(partsFullLabel)} · ≈ {formatUah(third(partsFullLabel))} × 3
                          </div>
                          <div className="pay-method__hint">
                            Після підтвердження фінальну суму в адмінці вже не змінюють
                          </div>
                        </div>
                        <div className="pay-method__price">{formatUah(partsFullLabel)}</div>
                      </div>
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

          <div style={{ textAlign: "center" }}>
            <div className="pay-secure">
              <IconShield /> Захищена оплата · Mono
            </div>
          </div>
        </section>

        <p className="pay-foot">
          Для Покупки частинами потрібен клієнт Monobank, вільний ліміт ПЧ і без інших незавершених
          заявок (після відмов зачекайте ~15 хвилин).
        </p>
      </div>
    </main>
  );
}
