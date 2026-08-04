"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  KeyRound,
  Link2,
  Loader2,
  Moon,
  Percent,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Timer,
  Wallet,
  Webhook,
  XCircle,
} from "lucide-react";
import { getAdminTenantId, saveAdminSettings } from "../adminApi";
import { showToast } from "../adminGlobals";
import type { AdminSettingsPayload, BookingRecord } from "../types";
import type { PublicBranding } from "@/lib/public-booking/types";
import {
  formatPrepaymentGuestLabel,
  readPrepaymentPolicy,
  type PrepaymentMode,
} from "@/lib/public-booking/prepaymentPolicy";
import { dobaWord } from "@/components/admin/desktop/adminPlural";
import { getStoredAuthToken } from "@/lib/gas-api";
import {
  DEFAULT_PAYMENT_SETTINGS,
  type PaymentSettingsPublic,
  type PaymentWebhookHealth,
} from "@/lib/payment/paymentSettings";
import type {
  PaymentAwaitingItem,
  PaymentFeedItem,
  PaymentHealthSnapshot,
} from "@/lib/payment/paymentOverview";
import "./settings-payment.css";
import "../settings/settings-additional-services.css";

const PREPAYMENT_MODES = [
  { mode: "percent" as const, label: "Відсоток", hint: "від суми броні", Icon: Percent },
  { mode: "nights" as const, label: "Доби", hint: "перші ночі за тарифом", Icon: Moon },
  { mode: "fixed" as const, label: "Фіксована", hint: "сума в ₴", Icon: Banknote },
];

const EMPTY_WEBHOOK: PaymentWebhookHealth = {
  lastAt: null,
  lastOk: null,
  lastStatus: null,
  lastChannel: null,
};

type PaymentSettingsPanelProps = {
  settings: AdminSettingsPayload;
  onSettingsChange: (next: AdminSettingsPayload) => void;
  isActive?: boolean;
  bookings?: BookingRecord[];
};

function readPayment(settings: AdminSettingsPayload): PaymentSettingsPublic {
  const raw = settings.paymentSettings;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const p = raw as Partial<PaymentSettingsPublic>;
    return {
      onlineEnabled: Boolean(p.onlineEnabled),
      monoPartsEnabled: p.monoPartsEnabled !== false,
      tokenConfigured: Boolean(p.tokenConfigured),
      tokenLast4: typeof p.tokenLast4 === "string" ? p.tokenLast4 : null,
      tokenFromEnv: Boolean(p.tokenFromEnv),
      forceOff: Boolean(p.forceOff),
      partsConfigured: Boolean(p.partsConfigured),
      webhook: p.webhook || EMPTY_WEBHOOK,
    };
  }
  return {
    ...DEFAULT_PAYMENT_SETTINGS,
    tokenConfigured: false,
    tokenLast4: null,
    tokenFromEnv: false,
    forceOff: false,
    partsConfigured: false,
    webhook: EMPTY_WEBHOOK,
  };
}

function readBranding(settings: AdminSettingsPayload): PublicBranding {
  return (settings.branding || {}) as PublicBranding;
}

function formatMoney(amount?: number): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return "—";
  return `${Math.round(amount).toLocaleString("uk-UA")} ₴`;
}

function formatWhen(iso?: string | null): string {
  if (!iso) return "ще не було";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("uk-UA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(ms: number | null): {
  label: string;
  tone: "ok" | "urgent" | "over";
} {
  if (ms == null) return { label: "без дедлайну", tone: "ok" };
  if (ms <= 0) return { label: "час вийшов", tone: "over" };
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 1) {
    return { label: `${h} год ${m} хв`, tone: h < 1 ? "urgent" : "ok" };
  }
  return { label: `${Math.max(1, m)} хв`, tone: "urgent" };
}

function outcomeLabel(outcome: PaymentFeedItem["outcome"]): string {
  if (outcome === "success") return "Успіх";
  if (outcome === "failure") return "Відхилено";
  return "Протерм.";
}

function formatShortDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
}

export function PaymentSettingsPanel({
  settings,
  onSettingsChange,
  isActive = true,
  bookings = [],
}: PaymentSettingsPanelProps) {
  const payment = useMemo(() => readPayment(settings), [settings]);
  const [onlineEnabled, setOnlineEnabled] = useState(payment.onlineEnabled);
  const [monoPartsEnabled, setMonoPartsEnabled] = useState(payment.monoPartsEnabled);
  const [newToken, setNewToken] = useState("");
  const [savingFlags, setSavingFlags] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [merchantName, setMerchantName] = useState<string | null>(null);

  const [branding, setBranding] = useState(() => readBranding(settings));
  const [savingPrepay, setSavingPrepay] = useState(false);

  const [overviewLoading, setOverviewLoading] = useState(false);
  const [health, setHealth] = useState<PaymentHealthSnapshot | null>(null);
  const [feed, setFeed] = useState<PaymentFeedItem[]>([]);
  const [awaiting, setAwaiting] = useState<PaymentAwaitingItem[]>([]);

  useEffect(() => {
    if (!isActive) return;
    setOnlineEnabled(payment.onlineEnabled);
    setMonoPartsEnabled(payment.monoPartsEnabled);
  }, [isActive, payment.onlineEnabled, payment.monoPartsEnabled]);

  useEffect(() => {
    setBranding(readBranding(settings));
  }, [settings.branding]);

  const loadOverview = useCallback(async (probe = true) => {
    const token = getStoredAuthToken();
    const tenantId = getAdminTenantId();
    if (!token || !tenantId) return;
    setOverviewLoading(true);
    try {
      const res = await fetch(
        `/api/admin/payments/overview${probe ? "" : "?probe=0"}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-tenant-id": tenantId,
          },
          cache: "no-store",
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        showToast(data?.message || "Не вдалося оновити огляд оплат");
        return;
      }
      setHealth(data.health as PaymentHealthSnapshot);
      setFeed(Array.isArray(data.feed) ? (data.feed as PaymentFeedItem[]) : []);
      setAwaiting(
        Array.isArray(data.awaiting) ? (data.awaiting as PaymentAwaitingItem[]) : []
      );
      if (data.health?.token?.merchantName) {
        setMerchantName(String(data.health.token.merchantName));
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Помилка огляду оплат");
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    void loadOverview(true);
  }, [isActive, loadOverview, bookings.length, payment.onlineEnabled, payment.tokenConfigured]);

  const prepaymentPolicy = readPrepaymentPolicy(branding);
  const prepaymentGuestLabel = formatPrepaymentGuestLabel(prepaymentPolicy);
  const prepaymentValueInput =
    branding.prepayment_value === undefined ||
    branding.prepayment_value === null ||
    branding.prepayment_value === 0
      ? ""
      : String(branding.prepayment_value);

  const persistPaymentFlags = useCallback(
    async (next: { onlineEnabled: boolean; monoPartsEnabled: boolean }) => {
      setSavingFlags(true);
      try {
        const paymentSettings = {
          onlineEnabled: next.onlineEnabled,
          monoPartsEnabled: next.monoPartsEnabled,
        };
        await saveAdminSettings(
          {
            ...settings,
            paymentSettings: paymentSettings as unknown as PaymentSettingsPublic,
          },
          { keys: ["paymentSettings"] }
        );
        onSettingsChange({
          ...settings,
          paymentSettings: {
            ...payment,
            ...paymentSettings,
            forceOff: payment.forceOff,
            partsConfigured: payment.partsConfigured,
            tokenConfigured: payment.tokenConfigured,
            tokenLast4: payment.tokenLast4,
            tokenFromEnv: payment.tokenFromEnv,
            webhook: payment.webhook,
          },
        });
        showToast(
          next.onlineEnabled
            ? "Онлайн-оплату увімкнено"
            : "Онлайн-оплату вимкнено — гості на сторінці очікування"
        );
        void loadOverview(false);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Не вдалося зберегти");
        setOnlineEnabled(payment.onlineEnabled);
        setMonoPartsEnabled(payment.monoPartsEnabled);
      } finally {
        setSavingFlags(false);
      }
    },
    [settings, onSettingsChange, payment, loadOverview]
  );

  const onToggleOnline = useCallback(() => {
    if (payment.forceOff || savingFlags) return;
    const next = !onlineEnabled;
    setOnlineEnabled(next);
    void persistPaymentFlags({ onlineEnabled: next, monoPartsEnabled });
  }, [payment.forceOff, savingFlags, onlineEnabled, monoPartsEnabled, persistPaymentFlags]);

  const onToggleParts = useCallback(() => {
    if (!payment.partsConfigured || savingFlags) return;
    const next = !monoPartsEnabled;
    setMonoPartsEnabled(next);
    void persistPaymentFlags({ onlineEnabled, monoPartsEnabled: next });
  }, [
    payment.partsConfigured,
    savingFlags,
    onlineEnabled,
    monoPartsEnabled,
    persistPaymentFlags,
  ]);

  const saveToken = useCallback(async () => {
    const token = newToken.trim();
    if (!token) {
      showToast("Вставте новий API-ключ Mono");
      return;
    }
    setSavingToken(true);
    try {
      await saveAdminSettings(
        {
          ...settings,
          paymentSettings: {
            onlineEnabled,
            monoPartsEnabled,
            monoAcquiringToken: token,
          } as unknown as PaymentSettingsPublic,
        },
        { keys: ["paymentSettings"] }
      );
      const last4 = token.slice(-4);
      onSettingsChange({
        ...settings,
        paymentSettings: {
          ...payment,
          onlineEnabled,
          monoPartsEnabled,
          tokenConfigured: true,
          tokenLast4: last4,
          tokenFromEnv: false,
        },
      });
      setNewToken("");
      setMerchantName(null);
      showToast("API-ключ Mono збережено");
      void loadOverview(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Не вдалося зберегти ключ");
    } finally {
      setSavingToken(false);
    }
  }, [
    newToken,
    onlineEnabled,
    monoPartsEnabled,
    settings,
    onSettingsChange,
    payment,
    loadOverview,
  ]);

  const testMono = useCallback(async () => {
    const token = getStoredAuthToken();
    const tenantId = getAdminTenantId();
    if (!token || !tenantId) {
      showToast("Не авторизовано");
      return;
    }
    setTesting(true);
    setMerchantName(null);
    try {
      const res = await fetch("/api/admin/payments/test-mono", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "x-tenant-id": tenantId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: newToken.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        showToast(data?.message || "Ключ невалідний або Mono недоступний");
        return;
      }
      const name = String(data.merchantName || data.merchantId || "OK").trim();
      setMerchantName(name);
      showToast(`Mono OK: ${name}`);
      void loadOverview(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Помилка перевірки Mono");
    } finally {
      setTesting(false);
    }
  }, [newToken, loadOverview]);

  const setPrepaymentMode = useCallback((mode: PrepaymentMode) => {
    setBranding((prev) => {
      const hasValue = prev.prepayment_value !== undefined && prev.prepayment_value !== null;
      const current = Number(prev.prepayment_value);
      return {
        ...prev,
        prepayment_mode: mode,
        prepayment_value: hasValue
          ? mode === "percent"
            ? Math.min(100, Math.max(0, current))
            : mode === "nights"
              ? Math.min(30, Math.max(0, current))
              : Math.max(0, current)
          : mode === "percent"
            ? 50
            : mode === "nights"
              ? 1
              : 0,
      };
    });
  }, []);

  const setPrepaymentValue = useCallback((raw: string, mode: PrepaymentMode) => {
    if (raw === "") {
      setBranding((prev) => ({ ...prev, prepayment_value: 0 }));
      return;
    }
    const n = Math.max(0, Math.round(Number(raw) || 0));
    const capped =
      mode === "percent" ? Math.min(100, n) : mode === "nights" ? Math.min(30, n) : n;
    setBranding((prev) => ({ ...prev, prepayment_value: capped }));
  }, []);

  const savePrepayment = useCallback(async () => {
    setSavingPrepay(true);
    try {
      const nextBranding = { ...readBranding(settings), ...branding };
      await saveAdminSettings(
        { ...settings, branding: nextBranding },
        { keys: ["branding"] }
      );
      onSettingsChange({ ...settings, branding: nextBranding });
      showToast("Передплату збережено");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Не вдалося зберегти передплату");
    } finally {
      setSavingPrepay(false);
    }
  }, [branding, settings, onSettingsChange]);

  const copyPayLink = useCallback(async (url: string, name: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast(`Посилання скопійовано · ${name}`);
    } catch {
      showToast("Не вдалося скопіювати");
    }
  }, []);

  const heroClass = [
    "pay-hero",
    payment.forceOff ? "pay-hero--force-off" : !onlineEnabled ? "pay-hero--off" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const tokenTone =
    health?.token.valid === true
      ? "ok"
      : health?.token.valid === false || !payment.tokenConfigured
        ? payment.tokenConfigured
          ? "danger"
          : "warn"
        : payment.tokenConfigured
          ? "ok"
          : "warn";

  const webhookTone =
    health?.webhook.lastOk === true
      ? "ok"
      : health?.webhook.lastOk === false
        ? "danger"
        : "warn";

  return (
    <div className="pay-page">
      <section className={heroClass}>
        <div className="pay-hero__main">
          <p className="pay-hero__eyebrow">Оплата на сайті</p>
          <h2 className="pay-hero__title">
            {payment.forceOff
              ? "Аварійно вимкнено"
              : onlineEnabled
                ? "Онлайн-оплата увімкнена"
                : "Онлайн-оплата вимкнена"}
          </h2>
          <p className="pay-hero__desc">
            {payment.forceOff
              ? "Env ONLINE_PAYMENT_FORCE_OFF блокує оплату незалежно від тумблера. Зніміть прапорець у Vercel, щоб керувати звідси."
              : onlineEnabled
                ? "Гості після бронювання переходять на сторінку оплати Mono (якщо бронь не потребує ручного підтвердження)."
                : "Гості потрапляють на сторінку очікування. Броні зі статусом «Очікує підтвердження» — ви підтверджуєте в адмінці."}
          </p>
          <div className="pay-hero__pills">
            <span
              className={`pay-pill${payment.tokenConfigured ? " pay-pill--ok" : " pay-pill--warn"}`}
            >
              <KeyRound size={14} aria-hidden />
              {payment.tokenConfigured
                ? `Ключ ••••${payment.tokenLast4 || "????"}`
                : "Ключ не задано"}
            </span>
            {payment.tokenFromEnv ? <span className="pay-pill">З Vercel env</span> : null}
            <span
              className={`pay-pill${
                payment.partsConfigured && monoPartsEnabled ? " pay-pill--ok" : " pay-pill"
              }`}
            >
              Parts{" "}
              {payment.partsConfigured
                ? monoPartsEnabled
                  ? "увімкнено"
                  : "вимкнено"
                : "не налаштовано"}
            </span>
          </div>
        </div>
        <div className="pay-hero__side">
          <div className="pay-flow">
            <span className="pay-flow__label">Шлях гостя</span>
            <div className="pay-flow__steps">
              <span className="pay-flow__step">Бронь</span>
              <span className="pay-flow__arrow" aria-hidden>
                →
              </span>
              <span className="pay-flow__step">
                {onlineEnabled && !payment.forceOff ? "Оплата Mono" : "Очікування"}
              </span>
              <span className="pay-flow__arrow" aria-hidden>
                →
              </span>
              <span className="pay-flow__step">
                {onlineEnabled && !payment.forceOff ? "Підтверджено" : "Ваше рішення"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {payment.forceOff ? (
        <div className="pay-banner pay-banner--danger" role="status">
          <ShieldOff size={18} aria-hidden />
          <div>
            Аварійний рубильник активний. Тумблер нижче не увімкне оплату, доки
            ONLINE_PAYMENT_FORCE_OFF увімкнено в середовищі.
          </div>
        </div>
      ) : null}

      {onlineEnabled && !payment.forceOff && !payment.tokenConfigured ? (
        <div className="pay-banner pay-banner--warn" role="status">
          <AlertTriangle size={18} aria-hidden />
          <div>
            Оплату увімкнено, але API-ключ Mono відсутній. Гості не зможуть завершити
            оплату — додайте ключ нижче.
          </div>
        </div>
      ) : null}

      <section className="pay-card">
        <div className="pay-section-head">
          <div>
            <h3 className="pay-card__title">Стан системи</h3>
            <p className="pay-card__hint">
              Ключ, webhook і вікно оплати 3 години — усе в одному погляді.
            </p>
          </div>
          <div className="pay-section-head__actions">
            <button
              type="button"
              className="pay-btn pay-btn--sm"
              disabled={overviewLoading}
              onClick={() => void loadOverview(true)}
            >
              {overviewLoading ? <Loader2 size={14} /> : <RefreshCw size={14} />}
              Оновити
            </button>
          </div>
        </div>

        {overviewLoading && !health ? (
          <div className="pay-health-grid">
            <div className="pay-skeleton" />
            <div className="pay-skeleton" />
            <div className="pay-skeleton" />
            <div className="pay-skeleton" />
          </div>
        ) : (
          <div className="pay-health-grid">
            <div className={`pay-health-cell pay-health-cell--${tokenTone}`}>
              <div className="pay-health-cell__top">
                <span className="pay-health-cell__label">Ключ Mono</span>
                <span className="pay-health-cell__icon">
                  <ShieldCheck size={15} aria-hidden />
                </span>
              </div>
              <p className="pay-health-cell__value">
                {health?.token.valid === true
                  ? "Валідний"
                  : health?.token.valid === false
                    ? "Помилка"
                    : payment.tokenConfigured
                      ? `••••${payment.tokenLast4 || ""}`
                      : "Немає"}
              </p>
              <p className="pay-health-cell__meta">
                {health?.token.merchantName ||
                  merchantName ||
                  (payment.tokenFromEnv ? "з Vercel env" : "еквайринг X-Token")}
              </p>
            </div>

            <div className={`pay-health-cell pay-health-cell--${webhookTone}`}>
              <div className="pay-health-cell__top">
                <span className="pay-health-cell__label">Webhook</span>
                <span className="pay-health-cell__icon">
                  <Webhook size={15} aria-hidden />
                </span>
              </div>
              <p className="pay-health-cell__value">
                {health?.webhook.lastOk === true
                  ? "OK"
                  : health?.webhook.lastOk === false
                    ? "Збій"
                    : "Очікує"}
              </p>
              <p className="pay-health-cell__meta">
                {formatWhen(health?.webhook.lastAt)}
                {health?.webhook.lastChannel
                  ? ` · ${health.webhook.lastChannel === "monoparts" ? "Parts" : "Pay"}`
                  : ""}
              </p>
            </div>

            <div className="pay-health-cell">
              <div className="pay-health-cell__top">
                <span className="pay-health-cell__label">Вікно оплати</span>
                <span className="pay-health-cell__icon">
                  <Timer size={15} aria-hidden />
                </span>
              </div>
              <p className="pay-health-cell__value">{health?.paymentWindowHours ?? 3} год</p>
              <p className="pay-health-cell__meta">
                Після цього бронь скасовується автоматично
              </p>
            </div>

            <div
              className={`pay-health-cell${
                (health?.awaitingCount || 0) > 0
                  ? " pay-health-cell--warn"
                  : " pay-health-cell--ok"
              }`}
            >
              <div className="pay-health-cell__top">
                <span className="pay-health-cell__label">Очікують оплату</span>
                <span className="pay-health-cell__icon">
                  <Clock3 size={15} aria-hidden />
                </span>
              </div>
              <p className="pay-health-cell__value">
                {health?.awaitingCount ?? awaiting.length}
              </p>
              <p className="pay-health-cell__meta">Можна скопіювати pay-link нижче</p>
            </div>
          </div>
        )}
      </section>

      <section className="pay-card">
        <div className="pay-section-head">
          <div>
            <h3 className="pay-card__title">Очікують оплату</h3>
            <p className="pay-card__hint">
              Швидко надішліть гостю посилання вручну — без SMS.
            </p>
          </div>
          <Link2 size={18} color="var(--pay-accent)" aria-hidden />
        </div>

        {overviewLoading && awaiting.length === 0 ? (
          <div className="pay-skeleton" />
        ) : awaiting.length === 0 ? (
          <div className="pay-empty">
            <CheckCircle2 size={22} color="var(--pay-ok)" aria-hidden />
            <strong>Немає броней в очікуванні оплати</strong>
            <span>Коли гість отримає статус «Очікує оплату» — зʼявиться тут.</span>
          </div>
        ) : (
          <div className="pay-await">
            {awaiting.map((item) => {
              const timer = formatCountdown(item.expiresInMs);
              return (
                <article key={item.bookingId} className="pay-await__card">
                  <div>
                    <h4 className="pay-await__name">{item.name}</h4>
                    <p className="pay-await__meta">
                      {item.cottage || "Котедж"} · {formatShortDate(item.checkIn)} —{" "}
                      {formatShortDate(item.checkOut)}
                      {item.prepayAmount > 0 ? ` · ${formatMoney(item.prepayAmount)}` : ""}
                      {` · ${item.bookingId}`}
                    </p>
                    <span
                      className={`pay-await__timer${
                        timer.tone === "urgent"
                          ? " pay-await__timer--urgent"
                          : timer.tone === "over"
                            ? " pay-await__timer--over"
                            : ""
                      }`}
                    >
                      <Clock3 size={13} aria-hidden />
                      {timer.label}
                    </span>
                  </div>
                  <div className="pay-await__actions">
                    <button
                      type="button"
                      className="pay-btn pay-btn--primary pay-btn--sm"
                      onClick={() => void copyPayLink(item.payUrl, item.name)}
                    >
                      <Copy size={14} />
                      Копіювати
                    </button>
                    <a
                      className="pay-btn pay-btn--sm"
                      href={item.payUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={14} />
                      Відкрити
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="pay-card">
        <div className="pay-section-head">
          <div>
            <h3 className="pay-card__title">Стрічка платежів</h3>
            <p className="pay-card__hint">
              Останні успіхи, відхилення Mono та протерміновані оплати.
            </p>
          </div>
          <Activity size={18} color="var(--pay-accent)" aria-hidden />
        </div>

        {overviewLoading && feed.length === 0 ? (
          <>
            <div className="pay-skeleton" style={{ marginBottom: 8 }} />
            <div className="pay-skeleton" />
          </>
        ) : feed.length === 0 ? (
          <div className="pay-empty">
            <Activity size={22} aria-hidden />
            <strong>Поки тихо</strong>
            <span>
              Тут зʼявляться платежі після webhook Mono або скасувань по таймеру.
            </span>
          </div>
        ) : (
          <div className="pay-feed">
            {feed.map((item) => (
              <div key={item.id} className="pay-feed__row">
                <span className={`pay-feed__badge pay-feed__badge--${item.outcome}`}>
                  {item.outcome === "success" ? (
                    <CheckCircle2 size={12} style={{ marginRight: 4 }} aria-hidden />
                  ) : item.outcome === "failure" ? (
                    <XCircle size={12} style={{ marginRight: 4 }} aria-hidden />
                  ) : (
                    <Clock3 size={12} style={{ marginRight: 4 }} aria-hidden />
                  )}
                  {outcomeLabel(item.outcome)}
                </span>
                <div className="pay-feed__main">
                  <p className="pay-feed__title">
                    {item.guestName || "Гість"}
                    {item.bookingId ? ` · ${item.bookingId}` : ""}
                  </p>
                  <p className="pay-feed__sub">
                    {item.provider || "Mono"}
                    {item.reason ? ` · ${item.reason}` : ""}
                    {item.transactionId ? ` · ${item.transactionId.slice(0, 10)}…` : ""}
                  </p>
                </div>
                <div className="pay-feed__side">
                  <p className="pay-feed__amount">{formatMoney(item.amount)}</p>
                  <p className="pay-feed__time">{formatWhen(item.at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="pay-card">
        <div className="pay-card__head">
          <div>
            <h3 className="pay-card__title">Онлайн-оплата</h3>
            <p className="pay-card__hint">
              Миттєво перемикає сайт між сторінкою оплати та очікуванням підтвердження.
            </p>
          </div>
        </div>
        <div className="pay-toggle-row">
          <div className="pay-toggle-row__text">
            <strong>Приймати оплату на сайті</strong>
            <span>
              {onlineEnabled
                ? "Увімкнено — показуємо /pay після бронювання"
                : "Вимкнено — заявка на підтвердження адміністратором"}
            </span>
          </div>
          <button
            type="button"
            className="pay-switch"
            role="switch"
            aria-checked={onlineEnabled && !payment.forceOff}
            aria-label="Онлайн-оплата на сайті"
            disabled={payment.forceOff || savingFlags}
            onClick={onToggleOnline}
          >
            <span className="pay-switch__knob" />
          </button>
        </div>

        <div className="pay-toggle-row" style={{ marginTop: 12 }}>
          <div className="pay-toggle-row__text">
            <strong>Покупка частинами</strong>
            <span>
              {payment.partsConfigured
                ? "Кнопка Mono Parts на сторінці оплати"
                : "Задайте MONO_CHAST_STORE_ID і MONO_CHAST_SIGN_KEY у Vercel"}
            </span>
          </div>
          <button
            type="button"
            className="pay-switch"
            role="switch"
            aria-checked={payment.partsConfigured && monoPartsEnabled}
            aria-label="Покупка частинами"
            disabled={!payment.partsConfigured || savingFlags}
            onClick={onToggleParts}
          >
            <span className="pay-switch__knob" />
          </button>
        </div>
      </section>

      <section className="pay-card">
        <div className="pay-card__head">
          <div>
            <h3 className="pay-card__title">API-ключ Mono</h3>
            <p className="pay-card__hint">
              Токен еквайрингу з кабінету web.monobank.ua. Повний ключ ніколи не
              показується після збереження — лише маска.
            </p>
          </div>
        </div>

        <p className="pay-field__meta">
          Поточний ключ:{" "}
          {payment.tokenConfigured ? (
            <>
              <code>••••••{payment.tokenLast4}</code>
              {payment.tokenFromEnv ? " (з Vercel env)" : ""}
            </>
          ) : (
            <strong>не задано</strong>
          )}
        </p>

        <label className="pay-field">
          <span className="pay-field__label">Новий ключ</span>
          <input
            className="pay-field__input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="Вставте X-Token від Mono…"
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
          />
        </label>

        <div className="pay-actions">
          <button
            type="button"
            className="pay-btn pay-btn--primary"
            disabled={savingToken || !newToken.trim()}
            onClick={() => void saveToken()}
          >
            {savingToken ? <Loader2 size={16} /> : <KeyRound size={16} />}
            Зберегти ключ
          </button>
          <button
            type="button"
            className="pay-btn"
            disabled={testing || (!newToken.trim() && !payment.tokenConfigured)}
            onClick={() => void testMono()}
          >
            {testing ? <Loader2 size={16} /> : <RefreshCw size={16} />}
            Перевірити зʼєднання
          </button>
        </div>

        {merchantName ? (
          <div className="pay-merchant">
            <CheckCircle2 size={16} style={{ display: "inline", verticalAlign: -3 }} /> Мерчант:{" "}
            {merchantName}
          </div>
        ) : null}
      </section>

      <section className="pay-card">
        <div className="pay-card__head">
          <div>
            <h3 className="pay-card__title">Передплата для гостей</h3>
            <p className="pay-card__hint">
              Скільки гість сплачує онлайн для підтвердження броні. Решту — на місці
              при заїзді.
            </p>
          </div>
          <Wallet size={20} color="var(--pay-accent)" aria-hidden />
        </div>

        <div className="pay-modes" role="group" aria-label="Тип передплати">
          {PREPAYMENT_MODES.map((option) => (
            <button
              key={option.mode}
              type="button"
              className={`pay-mode${prepaymentPolicy.mode === option.mode ? " is-active" : ""}`}
              onClick={() => setPrepaymentMode(option.mode)}
            >
              <span className="pay-mode__icon">
                <option.Icon size={16} />
              </span>
              <span>
                <strong>{option.label}</strong>
                <small>{option.hint}</small>
              </span>
            </button>
          ))}
        </div>

        <label className="pay-field">
          <span className="pay-field__label">
            {prepaymentPolicy.mode === "percent"
              ? "Відсоток від загальної суми"
              : prepaymentPolicy.mode === "nights"
                ? "Кількість перших ночей за тарифом"
                : "Сума передплати"}
          </span>
          <div
            className={`svc-field__suffix-wrap${
              prepaymentPolicy.mode === "nights" ? " svc-field__suffix-wrap--doba" : ""
            }`}
          >
            <input
              className="pay-field__input"
              type="number"
              min={0}
              max={prepaymentPolicy.mode === "percent" ? 100 : undefined}
              value={prepaymentValueInput}
              placeholder="0"
              onChange={(e) => setPrepaymentValue(e.target.value, prepaymentPolicy.mode)}
            />
            {prepaymentPolicy.mode === "percent" ? (
              <span className="svc-field__suffix">%</span>
            ) : prepaymentPolicy.mode === "fixed" ? (
              <span className="svc-field__suffix">₴</span>
            ) : (
              <span className="svc-field__suffix">
                {dobaWord(prepaymentPolicy.value > 0 ? prepaymentPolicy.value : 1)}
              </span>
            )}
          </div>
        </label>

        <p className="pay-preview">{prepaymentGuestLabel}</p>

        <div className="pay-actions">
          <button
            type="button"
            className="pay-btn pay-btn--primary"
            disabled={savingPrepay}
            onClick={() => void savePrepayment()}
          >
            {savingPrepay ? <Loader2 size={16} /> : null}
            Зберегти передплату
          </button>
        </div>
      </section>
    </div>
  );
}
