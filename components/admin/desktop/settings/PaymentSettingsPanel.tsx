"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  ExternalLink,
  KeyRound,
  Link2,
  Loader2,
  Moon,
  Percent,
  RefreshCw,
  Settings2,
  ShieldOff,
  Timer,
  Wallet,
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
  DEFAULT_PAYMENT_WINDOW_HOURS,
  PAYMENT_WINDOW_MAX_HOURS,
  PAYMENT_WINDOW_MIN_HOURS,
  PAYMENT_WINDOW_PRESETS,
  clampPaymentWindowHours,
  formatPaymentWindowPhrase,
  type PaymentSettingsPublic,
  type PaymentWebhookHealth,
} from "@/lib/payment/paymentSettings";
import type {
  PaymentAwaitingItem,
  PaymentFeedItem,
  PaymentHealthSnapshot,
} from "@/lib/payment/paymentOverviewTypes";
import {
  normalizeSmsSettings,
  syncPaymentLinkSmsWindowHours,
} from "@/lib/sms/smsSettings";
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

type PaySubView = "settings" | "awaiting" | "feed";

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
      paymentWindowHours: clampPaymentWindowHours(
        p.paymentWindowHours ?? DEFAULT_PAYMENT_WINDOW_HOURS
      ),
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
    paymentWindowHours: DEFAULT_PAYMENT_WINDOW_HOURS,
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
    return { label: `${h} год ${m} хв`, tone: "ok" };
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
  const [subView, setSubView] = useState<PaySubView>("settings");
  const [openWindow, setOpenWindow] = useState(false);
  const [openApi, setOpenApi] = useState(false);
  const [openPrepay, setOpenPrepay] = useState(false);
  const [onlineEnabled, setOnlineEnabled] = useState(payment.onlineEnabled);
  const [monoPartsEnabled, setMonoPartsEnabled] = useState(payment.monoPartsEnabled);
  const [windowHours, setWindowHours] = useState(payment.paymentWindowHours);
  const [newToken, setNewToken] = useState("");
  const [savingFlags, setSavingFlags] = useState(false);
  const [savingWindow, setSavingWindow] = useState(false);
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
    setWindowHours(payment.paymentWindowHours);
  }, [
    isActive,
    payment.onlineEnabled,
    payment.monoPartsEnabled,
    payment.paymentWindowHours,
  ]);

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
    async (next: {
      onlineEnabled: boolean;
      monoPartsEnabled: boolean;
      paymentWindowHours?: number;
    }) => {
      setSavingFlags(true);
      try {
        const paymentSettings = {
          onlineEnabled: next.onlineEnabled,
          monoPartsEnabled: next.monoPartsEnabled,
          paymentWindowHours:
            next.paymentWindowHours ?? payment.paymentWindowHours,
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
    void persistPaymentFlags({
      onlineEnabled: next,
      monoPartsEnabled,
      paymentWindowHours: windowHours,
    });
  }, [
    payment.forceOff,
    savingFlags,
    onlineEnabled,
    monoPartsEnabled,
    windowHours,
    persistPaymentFlags,
  ]);

  const onToggleParts = useCallback(() => {
    if (!payment.partsConfigured || savingFlags) return;
    const next = !monoPartsEnabled;
    setMonoPartsEnabled(next);
    void persistPaymentFlags({
      onlineEnabled,
      monoPartsEnabled: next,
      paymentWindowHours: windowHours,
    });
  }, [
    payment.partsConfigured,
    savingFlags,
    onlineEnabled,
    monoPartsEnabled,
    windowHours,
    persistPaymentFlags,
  ]);

  const savePaymentWindow = useCallback(async () => {
    const hours = clampPaymentWindowHours(windowHours);
    setWindowHours(hours);
    setSavingWindow(true);
    try {
      const paymentSettings = {
        onlineEnabled,
        monoPartsEnabled,
        paymentWindowHours: hours,
      };
      const sms = normalizeSmsSettings(settings.smsSettings);
      const nextSmsText = syncPaymentLinkSmsWindowHours(
        sms.templates.payment_link.text,
        hours
      );
      const smsChanged = nextSmsText !== sms.templates.payment_link.text;
      const nextSms = smsChanged
        ? {
            ...sms,
            templates: {
              ...sms.templates,
              payment_link: {
                ...sms.templates.payment_link,
                text: nextSmsText,
              },
            },
          }
        : null;

      await saveAdminSettings(
        {
          ...settings,
          paymentSettings: paymentSettings as unknown as PaymentSettingsPublic,
          ...(nextSms ? { smsSettings: nextSms } : {}),
        },
        { keys: nextSms ? ["paymentSettings", "smsSettings"] : ["paymentSettings"] }
      );
      onSettingsChange({
        ...settings,
        paymentSettings: {
          ...payment,
          ...paymentSettings,
        },
        ...(nextSms ? { smsSettings: nextSms } : {}),
      });
      showToast(
        `Вікно оплати: ${formatPaymentWindowPhrase(hours)}${
          smsChanged ? " · SMS оновлено" : ""
        }`
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Не вдалося зберегти вікно");
      setWindowHours(payment.paymentWindowHours);
    } finally {
      setSavingWindow(false);
    }
  }, [
    windowHours,
    onlineEnabled,
    monoPartsEnabled,
    settings,
    onSettingsChange,
    payment,
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
            paymentWindowHours: windowHours,
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
          paymentWindowHours: windowHours,
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
    windowHours,
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

  const keyOk =
    health?.token.valid === true ||
    (health?.token.valid !== false && payment.tokenConfigured);
  const keyTone = keyOk ? "ok" : "danger";
  const awaitingCount = health?.awaitingCount ?? awaiting.length;
  const windowDirty = clampPaymentWindowHours(windowHours) !== payment.paymentWindowHours;

  return (
    <div className="pay-page">
      <div className="pay-page__top">
        <div className="reports-tabs pay-subtabs">
          <button
            type="button"
            className={`r-tab${subView === "settings" ? " active" : ""}`}
            onClick={() => setSubView("settings")}
          >
            <Settings2 size={16} strokeWidth={1.75} aria-hidden />
            Налаштування
          </button>
          <button
            type="button"
            className={`r-tab${subView === "awaiting" ? " active" : ""}`}
            onClick={() => setSubView("awaiting")}
          >
            <Link2 size={16} strokeWidth={1.75} aria-hidden />
            Очікують
            {awaitingCount > 0 ? (
              <span className="pay-subtabs__count">{awaitingCount}</span>
            ) : null}
          </button>
          <button
            type="button"
            className={`r-tab${subView === "feed" ? " active" : ""}`}
            onClick={() => setSubView("feed")}
          >
            <Activity size={16} strokeWidth={1.75} aria-hidden />
            Стрічка
            {feed.length > 0 ? (
              <span className="pay-subtabs__count">{feed.length}</span>
            ) : null}
          </button>
        </div>
        {(subView === "awaiting" || subView === "feed") && (
          <button
            type="button"
            className="pay-btn pay-btn--sm"
            disabled={overviewLoading}
            onClick={() => void loadOverview(true)}
          >
            {overviewLoading ? <Loader2 size={14} /> : <RefreshCw size={14} />}
            Оновити
          </button>
        )}
      </div>

      {subView === "settings" ? (
        <>
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
                  className={`pay-key-chip pay-key-chip--${keyTone}`}
                  title={
                    keyOk
                      ? payment.tokenLast4
                        ? `Ключ ••••${payment.tokenLast4}`
                        : "Ключ валідний"
                      : "Ключ відсутній або невалідний"
                  }
                  aria-label={keyOk ? "Ключ OK" : "Ключ помилка"}
                >
                  <span className={`pay-key-dot pay-key-dot--${keyTone}`}>
                    <span className="pay-key-dot__pulse" aria-hidden />
                  </span>
                </span>
                <span
                  className={`pay-pill${
                    payment.partsConfigured && monoPartsEnabled
                      ? " pay-pill--ok"
                      : " pay-pill"
                  }`}
                >
                  {payment.partsConfigured && monoPartsEnabled ? (
                    <Check size={14} aria-hidden />
                  ) : null}
                  Оплата частинами
                  {!payment.partsConfigured
                    ? " · не налаштовано"
                    : !monoPartsEnabled
                      ? " · вимкнено"
                      : ""}
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

          <section className={`svc-accordion pay-accordion${openWindow ? " is-open" : ""}`}>
            <button
              type="button"
              className="svc-accordion__trigger"
              aria-expanded={openWindow}
              aria-controls="pay-window-panel"
              onClick={() => setOpenWindow((v) => !v)}
            >
              <div className="svc-accordion__trigger-main">
                <span className="svc-accordion__icon" aria-hidden>
                  <Timer size={18} />
                </span>
                <div className="svc-accordion__trigger-text">
                  <span className="svc-accordion__label">Вікно оплати</span>
                  <span className="svc-accordion__hint">
                    {formatPaymentWindowPhrase(payment.paymentWindowHours)} · потім бронь
                    скасовується
                  </span>
                </div>
              </div>
              <ChevronDown size={18} className="svc-accordion__chevron" aria-hidden />
            </button>
            <div
              id="pay-window-panel"
              className="svc-accordion__collapse"
              aria-hidden={!openWindow}
              inert={!openWindow}
            >
              <div className="svc-accordion__panel">
                <p className="svc-accordion__intro">
                  Скільки живе pay-link і текст у SMS. Після цього бронь скасовується
                  автоматично.
                </p>
                <div className="pay-window__presets" role="group" aria-label="Години вікна">
                  {PAYMENT_WINDOW_PRESETS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={`pay-window__chip${windowHours === h ? " is-active" : ""}`}
                      onClick={() => setWindowHours(h)}
                    >
                      {h} год
                    </button>
                  ))}
                </div>
                <div className="pay-window__custom">
                  <label className="pay-field" style={{ flex: 1, marginBottom: 0 }}>
                    <span className="pay-field__label">Своє значення (год)</span>
                    <input
                      className="pay-field__input"
                      type="number"
                      min={PAYMENT_WINDOW_MIN_HOURS}
                      max={PAYMENT_WINDOW_MAX_HOURS}
                      value={windowHours}
                      onChange={(e) =>
                        setWindowHours(
                          clampPaymentWindowHours(
                            e.target.value === ""
                              ? DEFAULT_PAYMENT_WINDOW_HOURS
                              : e.target.value
                          )
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="pay-btn pay-btn--primary"
                    disabled={savingWindow || !windowDirty}
                    onClick={() => void savePaymentWindow()}
                  >
                    {savingWindow ? <Loader2 size={16} /> : null}
                    Зберегти
                  </button>
                </div>
                <p className="pay-preview">
                  Зараз: {formatPaymentWindowPhrase(payment.paymentWindowHours)}. Нові броні
                  отримають цей дедлайн; SMS з &#123;hours&#125; підставляє його автоматично.
                </p>
              </div>
            </div>
          </section>

          <section className={`svc-accordion pay-accordion${openApi ? " is-open" : ""}`}>
            <button
              type="button"
              className="svc-accordion__trigger"
              aria-expanded={openApi}
              aria-controls="pay-api-panel"
              onClick={() => setOpenApi((v) => !v)}
            >
              <div className="svc-accordion__trigger-main">
                <span className="svc-accordion__icon" aria-hidden>
                  <KeyRound size={18} />
                </span>
                <div className="svc-accordion__trigger-text">
                  <span className="svc-accordion__label">API-ключ Mono</span>
                  <span className="svc-accordion__hint">
                    {payment.tokenConfigured
                      ? `••••${payment.tokenLast4 || "????"}${
                          merchantName || health?.token.merchantName
                            ? ` · ${merchantName || health?.token.merchantName}`
                            : ""
                        }`
                      : "Ключ не задано"}
                  </span>
                </div>
              </div>
              <ChevronDown size={18} className="svc-accordion__chevron" aria-hidden />
            </button>
            <div
              id="pay-api-panel"
              className="svc-accordion__collapse"
              aria-hidden={!openApi}
              inert={!openApi}
            >
              <div className="svc-accordion__panel">
                <p className="svc-accordion__intro">
                  Токен еквайрингу з кабінету web.monobank.ua. Повний ключ ніколи не
                  показується після збереження — лише маска.
                </p>

                <p className="pay-field__meta">
                  Поточний ключ:{" "}
                  {payment.tokenConfigured ? (
                    <>
                      <code>••••••{payment.tokenLast4}</code>
                      {merchantName || health?.token.merchantName
                        ? ` · ${merchantName || health?.token.merchantName}`
                        : ""}
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
                    <CheckCircle2 size={16} style={{ display: "inline", verticalAlign: -3 }} />{" "}
                    Мерчант: {merchantName}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className={`svc-accordion pay-accordion${openPrepay ? " is-open" : ""}`}>
            <button
              type="button"
              className="svc-accordion__trigger"
              aria-expanded={openPrepay}
              aria-controls="pay-prepay-panel"
              onClick={() => setOpenPrepay((v) => !v)}
            >
              <div className="svc-accordion__trigger-main">
                <span className="svc-accordion__icon" aria-hidden>
                  <Wallet size={18} />
                </span>
                <div className="svc-accordion__trigger-text">
                  <span className="svc-accordion__label">Передплата для гостей</span>
                  <span className="svc-accordion__hint">{prepaymentGuestLabel}</span>
                </div>
              </div>
              <ChevronDown size={18} className="svc-accordion__chevron" aria-hidden />
            </button>
            <div
              id="pay-prepay-panel"
              className="svc-accordion__collapse"
              aria-hidden={!openPrepay}
              inert={!openPrepay}
            >
              <div className="svc-accordion__panel">
                <p className="svc-accordion__intro">
                  Скільки гість сплачує онлайн для підтвердження броні. Решту — на місці
                  при заїзді.
                </p>

                <div className="pay-modes" role="group" aria-label="Тип передплати">
                  {PREPAYMENT_MODES.map((option) => (
                    <button
                      key={option.mode}
                      type="button"
                      className={`pay-mode${
                        prepaymentPolicy.mode === option.mode ? " is-active" : ""
                      }`}
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
                      prepaymentPolicy.mode === "nights"
                        ? " svc-field__suffix-wrap--doba"
                        : ""
                    }`}
                  >
                    <input
                      className="pay-field__input"
                      type="number"
                      min={0}
                      max={prepaymentPolicy.mode === "percent" ? 100 : undefined}
                      value={prepaymentValueInput}
                      placeholder="0"
                      onChange={(e) =>
                        setPrepaymentValue(e.target.value, prepaymentPolicy.mode)
                      }
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
              </div>
            </div>
          </section>
        </>
      ) : null}

      {subView === "awaiting" ? (
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
      ) : null}

      {subView === "feed" ? (
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
                <article
                  key={item.id}
                  className={`pay-feed__card pay-feed__card--${item.outcome}`}
                >
                  <div className="pay-feed__rail" aria-hidden />
                  <div className="pay-feed__body">
                    <div className="pay-feed__top">
                      <span className={`pay-feed__badge pay-feed__badge--${item.outcome}`}>
                        {item.outcome === "success" ? (
                          <CheckCircle2 size={13} aria-hidden />
                        ) : item.outcome === "failure" ? (
                          <XCircle size={13} aria-hidden />
                        ) : (
                          <Clock3 size={13} aria-hidden />
                        )}
                        {outcomeLabel(item.outcome)}
                      </span>
                      <time className="pay-feed__time" dateTime={item.at}>
                        {formatWhen(item.at)}
                      </time>
                    </div>
                    <p className="pay-feed__title">
                      {item.guestName || "Гість"}
                    </p>
                    <p className="pay-feed__sub">
                      {item.provider || "Mono"}
                      {item.bookingId ? ` · ${item.bookingId}` : ""}
                      {item.reason ? ` · ${item.reason}` : ""}
                    </p>
                    <div className="pay-feed__footer">
                      <span className="pay-feed__amount">{formatMoney(item.amount)}</span>
                      {item.transactionId ? (
                        <span className="pay-feed__tx">
                          {item.transactionId.slice(0, 12)}…
                        </span>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
