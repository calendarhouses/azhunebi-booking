"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  History,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  Send,
  Smartphone,
  Trash2,
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
  SMS_TEMPLATE_VARIABLES,
  mergeSmsJournal,
  normalizeSmsSettings,
  renderSmsTemplate,
  type SmsJournalEntry,
  type SmsSettings,
  type SmsTemplateId,
} from "@/lib/sms/smsSettings";
import { countSmsSegments, estimateSmsCost } from "@/lib/sms/smsSegments";
import { copyTurboSmsClientId, openEasyPayTurboSmsTopUp, TURBOSMS_CLIENT_ID } from "@/lib/sms/turbosmsTopup";
import {
  SmsJournalStatusBadge,
  hasPendingSmsDeliveries,
} from "./SmsJournalStatusBadge";
import { SmsJournalGuestCell } from "./SmsJournalGuestCell";
import type { BookingRecord } from "../types";
import "./settings-sms.css";

const TEMPLATE_ORDER: SmsTemplateId[] = [
  "payment_link",
  "review_approve",
  "review_reject",
  "admin_confirm",
  "admin_payment",
  "success",
  "expiry",
  "reject",
];

const SAMPLE_VARS: Record<string, string> = {
  name: "Олена",
  cottage: "Будинок №3",
  check_in: "24 липня",
  check_out: "31 липня",
  pay_url: "azhunebi.com/pay/ABC123",
  order_id: "ABC123",
  prepay: "1500 грн",
  hours: "1 год",
  hours_phrase: "1 година",
  site: "azhunebi.com",
  features: "раннім заїздом",
  approved_features: "раннім заїздом",
  rejected_features: "ранній заїзд",
  impossible_line: "ранній заїзд не можливий",
  retry_hint: "Спробуйте забронювати ще раз без раннього заїзду.",
  early_time: "10:00",
  late_time: "14:00",
};

const TYPE_LABELS: Record<SmsJournalEntry["type"], string> = {
  payment_link: "Оплата",
  review_approve: "Схвалення заявки",
  review_reject: "Відмова заявки",
  admin_confirm: "Нова бронь (адмінка)",
  admin_payment: "Передплата (адмінка)",
  success: "Успіх",
  expiry: "Скасування",
  reject: "Відмова",
  test: "Тест",
};

type SmsSubView = "settings" | "journal";
type JournalFilter = "all" | SmsJournalEntry["type"];
type ManualVarsMap = Record<SmsTemplateId, Record<string, string>>;

type SmsSettingsPanelProps = {
  settings: AdminSettingsPayload;
  onSettingsChange: (next: AdminSettingsPayload) => void;
  isActive?: boolean;
  bookings?: BookingRecord[];
  onShowGuestBookings?: (phone: string, name: string) => void;
};

function initialManualVars(): ManualVarsMap {
  return Object.fromEntries(
    TEMPLATE_ORDER.map((id) => [id, { ...SAMPLE_VARS }]),
  ) as ManualVarsMap;
}

function editableSlice(settings: SmsSettings): Omit<SmsSettings, "journal"> {
  return {
    pricePerSegment: settings.pricePerSegment,
    lowBalanceThreshold: settings.lowBalanceThreshold,
    testPhone: settings.testPhone,
    templates: settings.templates,
  };
}

function derivePricePerSegment(journal: SmsJournalEntry[]): number {
  const priced = journal.filter(
    (e) => e.ok && e.costEstimate != null && e.segments != null && e.segments > 0,
  );
  if (!priced.length) return DEFAULT_SMS_SETTINGS.pricePerSegment;
  const recent = priced.slice(0, 30);
  const totalCost = recent.reduce((s, e) => s + (e.costEstimate || 0), 0);
  const totalSegs = recent.reduce((s, e) => s + (e.segments || 0), 0);
  if (!totalSegs) return DEFAULT_SMS_SETTINGS.pricePerSegment;
  return Math.round((totalCost / totalSegs) * 100) / 100;
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
  return `${value.toFixed(2).replace(".", ",").replace(/,00$/, "")} грн`;
}

function formatJournalMeta(entry: SmsJournalEntry): string {
  const parts: string[] = [];
  if (entry.costEstimate != null) {
    parts.push(`Вартість: ${formatMoney(entry.costEstimate)}`);
  }
  if (entry.deliveryTime) {
    parts.push(`Оновлено ${entry.deliveryTime}`);
  }
  return parts.join("   ");
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

function insertAtCursor(textarea: HTMLTextAreaElement | null, snippet: string): string {
  if (!textarea) return snippet;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const next = `${textarea.value.slice(0, start)}${snippet}${textarea.value.slice(end)}`;
  window.requestAnimationFrame(() => {
    const pos = start + snippet.length;
    textarea.setSelectionRange(pos, pos);
    textarea.focus();
  });
  return next;
}

export function SmsSettingsPanel({
  settings,
  onSettingsChange,
  isActive = true,
  bookings = [],
  onShowGuestBookings,
}: SmsSettingsPanelProps) {
  const [form, setForm] = useState(() =>
    editableSlice(normalizeSmsSettings(settings.smsSettings)),
  );
  const [manualVars, setManualVars] = useState<ManualVarsMap>(initialManualVars);
  const [saving, setSaving] = useState(false);
  const [subView, setSubView] = useState<SmsSubView>("settings");
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [journal, setJournal] = useState<SmsJournalEntry[]>(() =>
    normalizeSmsSettings(settings.smsSettings).journal,
  );
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalFilter, setJournalFilter] = useState<JournalFilter>("all");
  const [sendingTemplateId, setSendingTemplateId] = useState<SmsTemplateId | null>(null);
  const [openTemplate, setOpenTemplate] = useState<SmsTemplateId | null>("payment_link");
  const textareaRefs = useRef<Partial<Record<SmsTemplateId, HTMLTextAreaElement | null>>>({});
  const serverKeyRef = useRef("");
  const dirtyRef = useRef(false);

  useEffect(() => {
    const key = JSON.stringify(editableSlice(normalizeSmsSettings(settings.smsSettings)));
    if (key === serverKeyRef.current) return;
    if (dirtyRef.current) return;
    serverKeyRef.current = key;
    const next = normalizeSmsSettings(settings.smsSettings);
    setForm(editableSlice(next));
    setJournal((prev) => mergeSmsJournal(prev, next.journal));
  }, [settings.smsSettings]);

  const pricePerSegment = useMemo(() => derivePricePerSegment(journal), [journal]);

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

  const loadJournal = useCallback(async (refresh = false) => {
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
        setJournal((prev) => mergeSmsJournal(prev, data.journal!));
      }
    } catch {
      /* keep local journal */
    } finally {
      setJournalLoading(false);
    }
  }, []);

  const clearJournal = useCallback(async () => {
    if (journal.length === 0) return;
    if (!window.confirm("Очистити весь журнал SMS? Це не скасувати.")) return;
    setJournalLoading(true);
    try {
      const res = await adminSmsFetch("/api/admin/sms/journal", { method: "DELETE" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        showToast(data.error || "Не вдалося очистити журнал");
        return;
      }
      setJournal([]);
      onSettingsChange({
        ...settings,
        smsSettings: {
          ...normalizeSmsSettings(settings.smsSettings),
          ...form,
          pricePerSegment,
          journal: [],
        },
      });
      showToast("Журнал SMS очищено");
    } catch {
      showToast("Немає зв'язку з сервером");
    } finally {
      setJournalLoading(false);
    }
  }, [form, journal.length, onSettingsChange, pricePerSegment, settings]);

  useEffect(() => {
    if (!isActive) return;
    void loadBalance();
    void loadJournal(false);
  }, [isActive, loadBalance, loadJournal]);

  useEffect(() => {
    if (!isActive || subView !== "journal") return;
    void loadJournal(true);
  }, [isActive, subView, loadJournal]);

  /** Auto-refresh pending deliveries every 8s while journal tab is open */
  useEffect(() => {
    if (!isActive || subView !== "journal") return;
    if (!hasPendingSmsDeliveries(journal)) return;

    const timer = window.setInterval(() => {
      void loadJournal(true);
    }, 8000);

    return () => window.clearInterval(timer);
  }, [isActive, subView, journal, loadJournal]);

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

  const patchManualVar = useCallback((id: SmsTemplateId, key: string, value: string) => {
    setManualVars((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const journalRes = await adminSmsFetch("/api/admin/sms/journal");
      const journalData = (await journalRes.json()) as { journal?: SmsJournalEntry[] };
      const currentJournal = Array.isArray(journalData.journal)
        ? mergeSmsJournal(journal, journalData.journal)
        : journal;

      const nextSettings: SmsSettings = {
        ...form,
        pricePerSegment,
        journal: currentJournal,
      };
      const next: AdminSettingsPayload = {
        ...settings,
        smsSettings: nextSettings,
      };
      serverKeyRef.current = JSON.stringify(editableSlice(nextSettings));
      dirtyRef.current = false;
      onSettingsChange(next);
      await saveAdminSettings(next, { keys: ["smsSettings"] });
      setJournal(currentJournal);
      showToast("SMS-налаштування збережено");
    } catch (e) {
      console.error("sms settings save:", e);
      showToast(e instanceof Error ? e.message : "Не вдалося зберегти SMS");
    } finally {
      setSaving(false);
    }
  }, [form, journal, onSettingsChange, pricePerSegment, settings]);

  const sendFromTemplate = useCallback(
    async (templateId: SmsTemplateId) => {
      const phoneDraft = form.testPhone || "";
      const parsed = parseStoredGuestPhone(phoneDraft);
      if (!isValidGuestPhone(parsed.iso, parsed.dial, parsed.national)) {
        showToast("Вкажіть коректний номер отримувача");
        return;
      }
      const phone = formatGuestPhoneForSave(parsed.iso, parsed.dial, parsed.national);
      const text = renderSmsTemplate(form.templates[templateId].text, manualVars[templateId]);

      setSendingTemplateId(templateId);
      try {
        const res = await adminSmsFetch("/api/admin/sms/test", {
          method: "POST",
          body: JSON.stringify({
            phone,
            text,
            templateId,
            smsSettings: { ...form, pricePerSegment },
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          journal?: SmsJournalEntry;
          journalAll?: SmsJournalEntry[];
          journalPersisted?: boolean;
        };
        if (!res.ok || !data.ok) {
          showToast(data.error || "SMS не надіслано");
          if (data.journal) {
            setJournal((prev) => mergeSmsJournal(prev, [data.journal!]));
          }
          return;
        }
        showToast("SMS надіслано");
        if (Array.isArray(data.journalAll) && data.journalAll.length) {
          setJournal(data.journalAll);
        } else if (data.journal) {
          setJournal((prev) => mergeSmsJournal(prev, [data.journal!]));
        }
        void loadJournal(true);
        if (data.journalPersisted === false) {
          showToast("SMS надіслано, але журнал не збережено — спробуйте ще раз");
        }
        void loadBalance();
      } catch {
        showToast("Помилка відправки SMS");
      } finally {
        setSendingTemplateId(null);
      }
    },
    [form, loadBalance, manualVars, pricePerSegment],
  );

  const balanceLow =
    balance != null &&
    balance < (form.lowBalanceThreshold || DEFAULT_SMS_SETTINGS.lowBalanceThreshold);

  const handleEasyPayTopUp = useCallback(async () => {
    const copied = await copyTurboSmsClientId();
    openEasyPayTurboSmsTopUp();
    showToast(
      copied
        ? "ID скопійовано — вставте на EasyPay і введіть суму"
        : `ID: ${TURBOSMS_CLIENT_ID} — введіть вручну на EasyPay`,
    );
  }, []);

  const templateStats = useMemo(() => {
    const map = {} as Record<
      SmsTemplateId,
      ReturnType<typeof countSmsSegments> & { cost: number; preview: string }
    >;
    for (const id of TEMPLATE_ORDER) {
      const text = form.templates[id].text;
      const preview = renderSmsTemplate(text, manualVars[id]);
      const seg = countSmsSegments(preview);
      map[id] = {
        ...seg,
        cost: estimateSmsCost(seg.segments, pricePerSegment),
        preview,
      };
    }
    return map;
  }, [form.templates, manualVars, pricePerSegment]);

  const filteredJournal = useMemo(() => {
    if (journalFilter === "all") return journal;
    return journal.filter((e) => e.type === journalFilter);
  }, [journal, journalFilter]);

  const journalStats = useMemo(() => {
    const ok = journal.filter((e) => e.ok).length;
    const fail = journal.length - ok;
    const cost = journal.reduce((s, e) => s + (e.costEstimate || 0), 0);
    return { ok, fail, cost, total: journal.length };
  }, [journal]);

  return (
    <div className="sms-page">
      <div className="sms-page__top">
        <p className="sms-page__intro">
          Автоматичні SMS гостям через TurboSMS. Відправляйте вручну з будь-якого шаблону.
        </p>
        <div className="reports-tabs sms-subtabs">
          <button
            type="button"
            className={`r-tab${subView === "settings" ? " active" : ""}`}
            onClick={() => setSubView("settings")}
          >
            <MessageSquareText size={16} strokeWidth={1.75} aria-hidden />
            SMS
          </button>
          <button
            type="button"
            className={`r-tab${subView === "journal" ? " active" : ""}`}
            onClick={() => setSubView("journal")}
          >
            <History size={16} strokeWidth={1.75} aria-hidden />
            Журнал
            {journal.length > 0 ? (
              <span className="sms-subtabs__count">{journal.length}</span>
            ) : null}
          </button>
        </div>
      </div>

      {subView === "settings" ? (
        <>
          <section className={`sms-balance ${balanceLow ? "sms-balance--low" : ""}`}>
            <div className="sms-balance__main">
              <div className="sms-balance__icon" aria-hidden>
                <Wallet size={22} strokeWidth={1.75} />
              </div>
              <div className="sms-balance__copy">
                <span className="sms-balance__label">Баланс</span>
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
                    Баланс нижче {formatMoney(form.lowBalanceThreshold)} — поповніть рахунок
                  </span>
                ) : null}
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
              <button
                type="button"
                className="btn-primary sms-topup"
                onClick={() => void handleEasyPayTopUp()}
              >
                Поповнити
                <ExternalLink size={15} aria-hidden />
              </button>
            </div>
          </section>

          <section className="sms-card">
            <header className="sms-card__header">
              <h3>Шаблони</h3>
              <p>Редагуйте текст, заповніть підстановки і надішліть SMS прямо з шаблону.</p>
            </header>
            <div className="sms-templates">
              {TEMPLATE_ORDER.map((id) => {
                const meta = SMS_TEMPLATE_META[id];
                const tpl = form.templates[id];
                const stats = templateStats[id];
                const open = openTemplate === id;
                const sending = sendingTemplateId === id;
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
                        <div className="sms-template__toolbar">
                          <label className="sms-switch">
                            <input
                              type="checkbox"
                              checked={tpl.enabled}
                              onChange={(e) => patchTemplate(id, { enabled: e.target.checked })}
                            />
                            <span>Надсилати автоматично</span>
                          </label>
                          <button
                            type="button"
                            className="btn-secondary sms-btn-icon sms-btn-sm"
                            onClick={() => {
                              patchTemplate(id, {
                                text: DEFAULT_SMS_SETTINGS.templates[id].text,
                              });
                              setManualVars((prev) => ({
                                ...prev,
                                [id]: { ...SAMPLE_VARS },
                              }));
                            }}
                          >
                            <RotateCcw size={14} />
                            Скинути
                          </button>
                        </div>

                        <div className="sms-template__editor">
                          <label className="sms-field sms-field--block">
                            <span className="sms-field__label">Текст SMS</span>
                            <textarea
                              ref={(el) => {
                                textareaRefs.current[id] = el;
                              }}
                              className="sms-field__textarea"
                              rows={4}
                              value={tpl.text}
                              onChange={(e) => patchTemplate(id, { text: e.target.value })}
                            />
                          </label>

                          <div className="sms-preview">
                            <div className="sms-preview__label">
                              <Smartphone size={14} aria-hidden />
                              Як побачить гість
                            </div>
                            <div className="sms-preview__bubble">{stats.preview}</div>
                          </div>
                        </div>

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
                            Залишок: <strong>{stats.remainingInSegment}</strong>
                          </span>
                          <span>
                            ~{formatMoney(stats.cost)}
                          </span>
                        </div>

                        <div className="sms-vars-section">
                          <span className="sms-vars-section__label">Змінні — натисніть, щоб вставити в текст</span>
                          <div className="sms-vars">
                            {SMS_TEMPLATE_VARIABLES.map((v) => (
                              <button
                                key={v.key}
                                type="button"
                                className="sms-var"
                                title={v.label}
                                onClick={() => {
                                  const snippet = `{${v.key}}`;
                                  const ta = textareaRefs.current[id] ?? null;
                                  const next = ta
                                    ? insertAtCursor(ta, snippet)
                                    : `${tpl.text}${snippet}`;
                                  patchTemplate(id, { text: next });
                                }}
                              >
                                {`{${v.key}}`}
                                <span>{v.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="sms-manual-vars">
                          <span className="sms-vars-section__label">Підстановки для відправки</span>
                          <div className="sms-manual-vars__grid">
                            {SMS_TEMPLATE_VARIABLES.map((v) => (
                              <label key={v.key} className="sms-manual-var">
                                <span className="sms-manual-var__label">{v.label}</span>
                                <input
                                  className="sms-manual-var__input"
                                  type="text"
                                  value={manualVars[id][v.key] || ""}
                                  onChange={(e) => patchManualVar(id, v.key, e.target.value)}
                                  placeholder={`{${v.key}}`}
                                />
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="sms-template__send">
                          <span className="sms-vars-section__label">Відправити SMS</span>
                          <div className="sms-test-row">
                            <div className="sms-field sms-field--grow">
                              <span className="sms-field__label">Номер отримувача</span>
                              <GuestPhoneField
                                value={form.testPhone || ""}
                                onChange={(value) => patchForm({ testPhone: value })}
                              />
                            </div>
                            <button
                              type="button"
                              className="btn-primary sms-test-btn"
                              onClick={() => void sendFromTemplate(id)}
                              disabled={sending}
                            >
                              <Send size={16} />
                              {sending ? "Надсилаємо…" : "Надіслати SMS"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <div className="sms-save-inline">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? "Збереження…" : "Зберегти SMS"}
            </button>
          </div>
        </>
      ) : (
        <section className="sms-card sms-card--journal">
          <header className="sms-card__header sms-card__header--row">
            <div>
              <h3>Журнал відправлених SMS</h3>
              <p>Останні відправки з вашого кабінету (до 100).</p>
            </div>
            <div className="sms-journal-actions">
              <button
                type="button"
                className="btn-secondary sms-btn-icon"
                onClick={() => void loadJournal(true)}
                disabled={journalLoading}
              >
                <RefreshCw size={16} className={journalLoading ? "sms-spin" : undefined} />
                {hasPendingSmsDeliveries(journal) ? "Оновлюємо статуси…" : "Оновити статуси"}
              </button>
              <button
                type="button"
                className="btn-secondary sms-btn-icon sms-btn-icon--danger"
                onClick={() => void clearJournal()}
                disabled={journalLoading || journal.length === 0}
              >
                <Trash2 size={16} />
                Очистити
              </button>
            </div>
          </header>

          <div className="sms-journal-stats">
            <div className="sms-journal-stat">
              <strong>{journalStats.total}</strong>
              <span>всього</span>
            </div>
            <div className="sms-journal-stat sms-journal-stat--ok">
              <strong>{journalStats.ok}</strong>
              <span>надіслано</span>
            </div>
            <div className="sms-journal-stat sms-journal-stat--fail">
              <strong>{journalStats.fail}</strong>
              <span>помилок</span>
            </div>
            <div className="sms-journal-stat">
              <strong>{formatMoney(journalStats.cost)}</strong>
              <span>орієнтовно</span>
            </div>
          </div>

          <div className="sms-journal-filters">
            {(["all", "payment_link", "review_approve", "review_reject", "admin_confirm", "admin_payment", "success", "expiry", "reject", "test"] as const).map(
              (key) => (
                <button
                  key={key}
                  type="button"
                  className={`sms-journal-filter${journalFilter === key ? " is-active" : ""}`}
                  onClick={() => setJournalFilter(key)}
                >
                  {key === "all" ? "Усі" : TYPE_LABELS[key]}
                </button>
              ),
            )}
          </div>

          {filteredJournal.length === 0 ? (
            <div className="sms-journal-empty">
              {journal.length === 0
                ? "Поки немає відправлених SMS."
                : "Немає записів для цього фільтра."}
            </div>
          ) : (
            <ul className="sms-journal">
              {filteredJournal.map((entry) => {
                const meta = formatJournalMeta(entry);
                return (
                <li key={entry.id} className={`sms-journal__item ${entry.ok ? "is-ok" : "is-fail"}`}>
                  <div className="sms-journal__layout">
                    <div className="sms-journal__main">
                      <div className="sms-journal__top">
                        <span className="sms-pill">{TYPE_LABELS[entry.type]}</span>
                        <SmsJournalStatusBadge entry={entry} />
                        <time dateTime={entry.at}>{formatJournalTime(entry.at)}</time>
                      </div>
                      <p className="sms-journal__text">{entry.text}</p>
                      {meta ? <div className="sms-journal__meta">{meta}</div> : null}
                    </div>
                    <SmsJournalGuestCell
                      phone={entry.phone}
                      bookings={bookings}
                      onShowGuestBookings={onShowGuestBookings}
                    />
                  </div>
                </li>
              );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
