"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  MessageSquareText,
  RefreshCw,
  Send,
  Wallet,
} from "lucide-react";
import { getAdminTenantId, saveAdminSettings } from "../adminApi";
import { showToast } from "../adminGlobals";
import type { AdminSettingsPayload } from "../types";
import { GuestPhoneField } from "@/components/admin/onboarding/GuestPhoneField";
import { getStoredAuthToken } from "@/lib/gas-api";
import {
  formatGuestPhoneForSave,
  isValidGuestPhone,
  parseStoredGuestPhone,
} from "@/lib/admin/onboarding/uaPhone";
import {
  DEFAULT_SMS_SETTINGS,
  SMS_TEMPLATE_META,
  normalizeSmsSettings,
  type SmsJournalEntry,
  type SmsSettings,
  type SmsTemplateId,
} from "@/lib/sms/smsSettings";
import { countSmsSegments, estimateSmsCost } from "@/lib/sms/smsSegments";
import "./settings-sms.css";

const TURBOSMS_CABINET_URL = "https://turbosms.ua/";
const TEMPLATE_ORDER: SmsTemplateId[] = [
  "payment_link",
  "success",
  "expiry",
  "reject",
];

const TYPE_LABELS: Record<SmsJournalEntry["type"], string> = {
  payment_link: "Оплата",
  success: "Успіх",
  expiry: "Скасування",
  reject: "Відмова",
  test: "Тест",
};

type SmsSettingsPanelProps = {
  settings: AdminSettingsPayload;
  onSettingsChange: (next: AdminSettingsPayload) => void;
  isActive?: boolean;
};

function editableSlice(settings: SmsSettings): Omit<SmsSettings, "journal"> {
  return {
    pricePerSegment: settings.pricePerSegment,
    lowBalanceThreshold: settings.lowBalanceThreshold,
    testPhone: settings.testPhone,
    templates: settings.templates,
  };
}

async function adminSmsFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getStoredAuthToken();
  const headers = new Headers(init?.headers);
  headers.set("x-tenant-id", getAdminTenantId());
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.method === "POST" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(path, { ...init, headers, cache: "no-store" });
}

function formatMoney(value: number): string {
  return `${value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")} грн`;
}

function formatJournalTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SmsSettingsPanel({
  settings,
  onSettingsChange,
  isActive = true,
}: SmsSettingsPanelProps) {
  const [form, setForm] = useState(() =>
    editableSlice(normalizeSmsSettings(settings.smsSettings)),
  );
  const [saving, setSaving] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [journal, setJournal] = useState<SmsJournalEntry[]>(() =>
    normalizeSmsSettings(settings.smsSettings).journal,
  );
  const [journalLoading, setJournalLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [openTemplate, setOpenTemplate] = useState<SmsTemplateId | null>("payment_link");
  const serverKeyRef = useRef("");
  const dirtyRef = useRef(false);

  useEffect(() => {
    const key = JSON.stringify(editableSlice(normalizeSmsSettings(settings.smsSettings)));
    if (key === serverKeyRef.current) return;
    if (dirtyRef.current) return;
    serverKeyRef.current = key;
    const next = normalizeSmsSettings(settings.smsSettings);
    setForm(editableSlice(next));
    setJournal(next.journal);
  }, [settings.smsSettings]);

  const loadBalance = useCallback(async () => {
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      const res = await adminSmsFetch("/api/admin/sms/balance");
      const data = (await res.json()) as { ok?: boolean; balance?: number; error?: string };
      if (!res.ok || !data.ok || typeof data.balance !== "number") {
        setBalance(null);
        setBalanceError(data.error || "Не вдалося отримати баланс");
        return;
      }
      setBalance(data.balance);
    } catch {
      setBalance(null);
      setBalanceError("Немає зв'язку з TurboSMS");
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const loadJournal = useCallback(async (refresh = true) => {
    setJournalLoading(true);
    try {
      const res = await adminSmsFetch(
        `/api/admin/sms/journal${refresh ? "?refresh=true" : ""}`,
      );
      const data = (await res.json()) as {
        ok?: boolean;
        journal?: SmsJournalEntry[];
      };
      if (res.ok && data.ok && Array.isArray(data.journal)) {
        setJournal(data.journal);
      }
    } catch {
      /* keep local journal */
    } finally {
      setJournalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    void loadBalance();
    void loadJournal(true);
  }, [isActive, loadBalance, loadJournal]);

  const patchForm = useCallback((patch: Partial<Omit<SmsSettings, "journal">>) => {
    dirtyRef.current = true;
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const patchTemplate = useCallback(
    (id: SmsTemplateId, patch: Partial<SmsSettings["templates"][SmsTemplateId]>) => {
      dirtyRef.current = true;
      setForm((prev) => ({
        ...prev,
        templates: {
          ...prev.templates,
          [id]: { ...prev.templates[id], ...patch },
        },
      }));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const nextSettings: SmsSettings = {
        ...form,
        journal,
      };
      const next: AdminSettingsPayload = {
        ...settings,
        smsSettings: nextSettings,
      };
      serverKeyRef.current = JSON.stringify(editableSlice(nextSettings));
      dirtyRef.current = false;
      onSettingsChange(next);
      await saveAdminSettings(next, { keys: ["smsSettings"] });
      showToast("SMS-налаштування збережено");
    } catch (e) {
      console.error("sms settings save:", e);
      showToast(e instanceof Error ? e.message : "Не вдалося зберегти SMS");
    } finally {
      setSaving(false);
    }
  }, [form, journal, onSettingsChange, settings]);

  const handleTestSend = useCallback(async () => {
    const phoneDraft = form.testPhone || "";
    const parsed = parseStoredGuestPhone(phoneDraft);
    if (!isValidGuestPhone(parsed.iso, parsed.dial, parsed.national)) {
      showToast("Вкажіть коректний тестовий номер");
      return;
    }
    const phone = formatGuestPhoneForSave(parsed.iso, parsed.dial, parsed.national);
    setTestSending(true);
    try {
      const res = await adminSmsFetch("/api/admin/sms/test", {
        method: "POST",
        body: JSON.stringify({
          phone,
          text: "Тест SMS з кабінету АЖ У НЕБІ. Якщо ви отримали це повідомлення — TurboSMS працює.",
          smsSettings: { ...form, journal: [] },
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        journal?: SmsJournalEntry;
      };
      if (!res.ok || !data.ok) {
        showToast(data.error || "Тестове SMS не надіслано");
        return;
      }
      showToast("Тестове SMS надіслано");
      if (data.journal) setJournal((prev) => [data.journal!, ...prev].slice(0, 100));
      void loadBalance();
    } catch {
      showToast("Помилка відправки тестового SMS");
    } finally {
      setTestSending(false);
    }
  }, [form, loadBalance]);

  const balanceLow =
    balance != null && balance < (form.lowBalanceThreshold || DEFAULT_SMS_SETTINGS.lowBalanceThreshold);

  const templateStats = useMemo(() => {
    const map = {} as Record<
      SmsTemplateId,
      ReturnType<typeof countSmsSegments> & { cost: number }
    >;
    for (const id of TEMPLATE_ORDER) {
      const seg = countSmsSegments(form.templates[id].text);
      map[id] = {
        ...seg,
        cost: estimateSmsCost(seg.segments, form.pricePerSegment || 0),
      };
    }
    return map;
  }, [form.pricePerSegment, form.templates]);

  return (
    <div className="sms-page">
      <p className="sms-page__intro">
        Шаблони автоматичних SMS гостям, тариф за сегмент і журнал відправок через TurboSMS.
      </p>

      <section className={`sms-balance ${balanceLow ? "sms-balance--low" : ""}`}>
        <div className="sms-balance__main">
          <div className="sms-balance__icon" aria-hidden>
            <Wallet size={22} strokeWidth={1.75} />
          </div>
          <div className="sms-balance__copy">
            <span className="sms-balance__label">Баланс TurboSMS</span>
            <strong className="sms-balance__value">
              {balanceLoading && balance == null
                ? "…"
                : balance != null
                  ? formatMoney(balance)
                  : "—"}
            </strong>
            {balanceError ? (
              <span className="sms-balance__hint sms-balance__hint--error">{balanceError}</span>
            ) : balanceLow ? (
              <span className="sms-balance__hint sms-balance__hint--warn">
                Баланс нижче порогу {formatMoney(form.lowBalanceThreshold)}
              </span>
            ) : (
              <span className="sms-balance__hint">Оновлюється з API TurboSMS</span>
            )}
          </div>
        </div>
        <div className="sms-balance__actions">
          <button
            type="button"
            className="btn-secondary sms-btn-icon"
            onClick={() => void loadBalance()}
            disabled={balanceLoading}
            aria-label="Оновити баланс"
          >
            <RefreshCw size={16} className={balanceLoading ? "sms-spin" : undefined} />
            Оновити
          </button>
          <a
            className="btn-primary sms-topup"
            href={TURBOSMS_CABINET_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Поповнити
            <ExternalLink size={15} aria-hidden />
          </a>
        </div>
      </section>

      <section className="sms-card">
        <header className="sms-card__header">
          <h3>Тариф</h3>
          <p>Вкажіть вартість одного сегмента SMS у гривнях (як у кабінеті TurboSMS).</p>
        </header>
        <div className="sms-tariff-grid">
          <label className="sms-field">
            <span className="sms-field__label">грн за сегмент</span>
            <input
              className="sms-field__input"
              type="number"
              min={0}
              step={0.01}
              inputMode="decimal"
              value={form.pricePerSegment}
              onChange={(e) =>
                patchForm({
                  pricePerSegment: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </label>
          <label className="sms-field">
            <span className="sms-field__label">Поріг низького балансу</span>
            <input
              className="sms-field__input"
              type="number"
              min={0}
              step={1}
              inputMode="decimal"
              value={form.lowBalanceThreshold}
              onChange={(e) =>
                patchForm({
                  lowBalanceThreshold: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </label>
        </div>
      </section>

      <section className="sms-card">
        <header className="sms-card__header">
          <h3>Шаблони</h3>
          <p>Чотири автоматичні повідомлення. Кирилиця: до 70 символів у 1 SMS.</p>
        </header>
        <div className="sms-templates">
          {TEMPLATE_ORDER.map((id) => {
            const meta = SMS_TEMPLATE_META[id];
            const tpl = form.templates[id];
            const stats = templateStats[id];
            const open = openTemplate === id;
            return (
              <article
                key={id}
                className={`sms-template ${open ? "is-open" : ""} ${tpl.enabled ? "" : "is-disabled"}`}
              >
                <button
                  type="button"
                  className="sms-template__trigger"
                  onClick={() => setOpenTemplate(open ? null : id)}
                  aria-expanded={open}
                >
                  <span className="sms-template__icon" aria-hidden>
                    <MessageSquareText size={18} strokeWidth={1.75} />
                  </span>
                  <span className="sms-template__titles">
                    <strong>{meta.title}</strong>
                    <span>{meta.when}</span>
                  </span>
                  <span className="sms-template__meta">
                    <span className="sms-pill">
                      {stats.segments} SMS · {formatMoney(stats.cost)}
                    </span>
                    <span className={`sms-status ${tpl.enabled ? "is-on" : "is-off"}`}>
                      {tpl.enabled ? "Увімкнено" : "Вимкнено"}
                    </span>
                  </span>
                </button>

                {open ? (
                  <div className="sms-template__body">
                    <label className="sms-switch">
                      <input
                        type="checkbox"
                        checked={tpl.enabled}
                        onChange={(e) => patchTemplate(id, { enabled: e.target.checked })}
                      />
                      <span>Надсилати цей шаблон автоматично</span>
                    </label>

                    <label className="sms-field sms-field--block">
                      <span className="sms-field__label">Текст SMS</span>
                      <textarea
                        className="sms-field__textarea"
                        rows={4}
                        value={tpl.text}
                        onChange={(e) => patchTemplate(id, { text: e.target.value })}
                      />
                    </label>

                    <div className="sms-template__stats">
                      <span>
                        Символів: <strong>{stats.chars}</strong>
                      </span>
                      <span>
                        Кодування:{" "}
                        <strong>{stats.encoding === "unicode" ? "кирилиця" : "латиниця"}</strong>
                      </span>
                      <span>
                        Сегментів: <strong>{stats.segments}</strong>
                      </span>
                      <span>
                        Залишок у сегменті: <strong>{stats.remainingInSegment}</strong>
                      </span>
                      <span>
                        Орієнтовна вартість: <strong>{formatMoney(stats.cost)}</strong>
                      </span>
                    </div>

                    <div className="sms-vars">
                      {meta.variables.map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          className="sms-var"
                          title={v.label}
                          onClick={() =>
                            patchTemplate(id, {
                              text: `${tpl.text}{${v.key}}`.replace(/\s{2,}/g, " "),
                            })
                          }
                        >
                          {`{${v.key}}`}
                          <span>{v.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="sms-card">
        <header className="sms-card__header">
          <h3>Тестова відправка</h3>
          <p>Перевірте TurboSMS на свій номер перед запуском для гостей.</p>
        </header>
        <div className="sms-test-row">
          <div className="sms-field sms-field--grow">
            <span className="sms-field__label">Номер для тестів</span>
            <GuestPhoneField
              value={form.testPhone || ""}
              onChange={(value) => patchForm({ testPhone: value })}
            />
          </div>
          <button
            type="button"
            className="btn-secondary sms-test-btn"
            onClick={() => void handleTestSend()}
            disabled={testSending}
          >
            <Send size={16} />
            {testSending ? "Надсилаємо…" : "Надіслати тест"}
          </button>
        </div>
      </section>

      <section className="sms-card">
        <header className="sms-card__header sms-card__header--row">
          <div>
            <h3>Журнал відправлених SMS</h3>
            <p>Останні відправки з вашого кабінету (до 100).</p>
          </div>
          <button
            type="button"
            className="btn-secondary sms-btn-icon"
            onClick={() => void loadJournal(true)}
            disabled={journalLoading}
          >
            <RefreshCw size={16} className={journalLoading ? "sms-spin" : undefined} />
            Оновити
          </button>
        </header>

        {journal.length === 0 ? (
          <div className="sms-journal-empty">Поки немає відправлених SMS.</div>
        ) : (
          <ul className="sms-journal">
            {journal.map((entry) => (
              <li key={entry.id} className={`sms-journal__item ${entry.ok ? "is-ok" : "is-fail"}`}>
                <div className="sms-journal__top">
                  <span className="sms-pill">{TYPE_LABELS[entry.type]}</span>
                  <time dateTime={entry.at}>{formatJournalTime(entry.at)}</time>
                  <span className="sms-journal__phone">{entry.phone}</span>
                  <span className={`sms-journal__status ${entry.ok ? "is-ok" : "is-fail"}`}>
                    {entry.ok ? entry.deliveryStatus || "надіслано" : entry.error || "помилка"}
                  </span>
                </div>
                <p className="sms-journal__text">{entry.text}</p>
                <div className="sms-journal__foot">
                  {entry.segments != null ? <span>{entry.segments} сегм.</span> : null}
                  {entry.costEstimate != null ? (
                    <span>~{formatMoney(entry.costEstimate)}</span>
                  ) : null}
                  {entry.bookingId ? <span>#{entry.bookingId}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="sms-save-bar">
        <button
          type="button"
          className="btn-primary settings-save-action--sticky"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? "Збереження…" : "Зберегти SMS"}
        </button>
      </div>
    </div>
  );
}
