"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  KeyRound,
  Loader2,
  Moon,
  Percent,
  RefreshCw,
  ShieldOff,
  Wallet,
} from "lucide-react";
import { getAdminTenantId, saveAdminSettings } from "../adminApi";
import { showToast } from "../adminGlobals";
import type { AdminSettingsPayload } from "../types";
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
} from "@/lib/payment/paymentSettings";
import "./settings-payment.css";
import "../settings/settings-additional-services.css";

const PREPAYMENT_MODES = [
  { mode: "percent" as const, label: "Відсоток", hint: "від суми броні", Icon: Percent },
  { mode: "nights" as const, label: "Доби", hint: "перші ночі за тарифом", Icon: Moon },
  { mode: "fixed" as const, label: "Фіксована", hint: "сума в ₴", Icon: Banknote },
];

type PaymentSettingsPanelProps = {
  settings: AdminSettingsPayload;
  onSettingsChange: (next: AdminSettingsPayload) => void;
  isActive?: boolean;
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
    };
  }
  return {
    ...DEFAULT_PAYMENT_SETTINGS,
    tokenConfigured: false,
    tokenLast4: null,
    tokenFromEnv: false,
    forceOff: false,
    partsConfigured: false,
  };
}

function readBranding(settings: AdminSettingsPayload): PublicBranding {
  return (settings.branding || {}) as PublicBranding;
}

export function PaymentSettingsPanel({
  settings,
  onSettingsChange,
  isActive = true,
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

  useEffect(() => {
    if (!isActive) return;
    setOnlineEnabled(payment.onlineEnabled);
    setMonoPartsEnabled(payment.monoPartsEnabled);
  }, [isActive, payment.onlineEnabled, payment.monoPartsEnabled]);

  useEffect(() => {
    setBranding(readBranding(settings));
  }, [settings.branding]);

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
          },
        });
        showToast(
          next.onlineEnabled
            ? "Онлайн-оплату увімкнено"
            : "Онлайн-оплату вимкнено — гості на сторінці очікування"
        );
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Не вдалося зберегти");
        setOnlineEnabled(payment.onlineEnabled);
        setMonoPartsEnabled(payment.monoPartsEnabled);
      } finally {
        setSavingFlags(false);
      }
    },
    [settings, onSettingsChange, payment]
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
      const paymentSettings = {
        onlineEnabled,
        monoPartsEnabled,
        monoAcquiringToken: token,
      };
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
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Помилка перевірки Mono");
    } finally {
      setTesting(false);
    }
  }, [newToken]);

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

  const heroClass = [
    "pay-hero",
    payment.forceOff ? "pay-hero--force-off" : !onlineEnabled ? "pay-hero--off" : "",
  ]
    .filter(Boolean)
    .join(" ");

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
            {payment.tokenFromEnv ? (
              <span className="pay-pill">З Vercel env</span>
            ) : null}
            <span
              className={`pay-pill${
                payment.partsConfigured && monoPartsEnabled
                  ? " pay-pill--ok"
                  : " pay-pill"
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
            Оплату увімкнено, але API-ключ Mono відсутній. Гості не зможуть
            завершити оплату — додайте ключ нижче.
          </div>
        </div>
      ) : null}

      <section className="pay-card">
        <div className="pay-card__head">
          <div>
            <h3 className="pay-card__title">Онлайн-оплата</h3>
            <p className="pay-card__hint">
              Миттєво перемикає сайт між сторінкою оплати та очікуванням
              підтвердження.
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
            {savingToken ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            Зберегти ключ
          </button>
          <button
            type="button"
            className="pay-btn"
            disabled={testing || (!newToken.trim() && !payment.tokenConfigured)}
            onClick={() => void testMono()}
          >
            {testing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Перевірити зʼєднання
          </button>
        </div>

        {merchantName ? (
          <div className="pay-merchant">
            <CheckCircle2 size={16} style={{ display: "inline", verticalAlign: -3 }} />{" "}
            Мерчант: {merchantName}
          </div>
        ) : null}
      </section>

      <section className="pay-card">
        <div className="pay-card__head">
          <div>
            <h3 className="pay-card__title">Передплата для гостей</h3>
            <p className="pay-card__hint">
              Скільки гість сплачує онлайн для підтвердження броні. Решту — на
              місці при заїзді.
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
      </section>
    </div>
  );
}
