import type { GasBookingRecord } from "@/lib/gas-api";

export type SmsTemplateId = "payment_link" | "success" | "expiry" | "reject";

export type SmsTemplateConfig = {
  enabled: boolean;
  text: string;
};

export type SmsJournalEntry = {
  id: string;
  at: string; // ISO timestamp
  type: SmsTemplateId | "test";
  phone: string;
  text: string;
  ok: boolean;
  messageId?: string | null;
  segments?: number;
  costEstimate?: number;
  error?: string;
  bookingId?: string;
  /** Enriched via TurboSMS message/details (not persisted). */
  deliveryStatus?: string;
  deliveryTime?: string;
};

export type SmsSettings = {
  pricePerSegment: number; // default 1.29
  lowBalanceThreshold: number; // default 20
  testPhone?: string;
  templates: Record<SmsTemplateId, SmsTemplateConfig>;
  journal: SmsJournalEntry[]; // max 100, newest first
};

export const SMS_TEMPLATE_META: Record<
  SmsTemplateId,
  { title: string; when: string; variables: { key: string; label: string }[] }
> = {
  payment_link: {
    title: "Посилання на оплату",
    when: "Після створення резерву (очікує оплату)",
    variables: [
      { key: "pay_url", label: "URL оплати" },
      { key: "order_id", label: "Номер замовлення" },
    ],
  },
  success: {
    title: "Підтвердження бронювання",
    when: "Після отримання передоплати",
    variables: [
      { key: "name", label: "Ім'я гостя" },
      { key: "cottage", label: "Назва котеджу" },
      { key: "check_in", label: "Дата заїзду" },
      { key: "check_out", label: "Дата виїзду" },
      { key: "prepay", label: "Сума передоплати" },
    ],
  },
  expiry: {
    title: "Скасування резерву",
    when: "Після закінчення часу на оплату",
    variables: [
      { key: "name", label: "Ім'я гостя" },
      { key: "cottage", label: "Назва котеджу" },
      { key: "site", label: "Сайт" },
    ],
  },
  reject: {
    title: "Відмова в бронюванні",
    when: "Після рішення адміністратора відхилити бронь",
    variables: [
      { key: "name", label: "Ім'я гостя" },
      { key: "cottage", label: "Назва котеджу" },
      { key: "check_in", label: "Дата заїзду" },
      { key: "check_out", label: "Дата виїзду" },
    ],
  },
};

const DEFAULT_TEXTS: Record<SmsTemplateId, string> = {
  payment_link: "Оплата резерву (3 год): {pay_url}",
  success: "Передоплату отримано. Бронювання підтверджено. АЖ У НЕБІ",
  expiry: "Резерв скасовано: передоплату не отримано. azhunebi.com",
  reject:
    "{name}, на жаль, бронь скасовано. {cottage}, {check_in} — {check_out}. Спробуйте забронювати інші дати на сайті.",
};

export const DEFAULT_SMS_SETTINGS: SmsSettings = {
  pricePerSegment: 1.29,
  lowBalanceThreshold: 20,
  templates: {
    payment_link: { enabled: true, text: DEFAULT_TEXTS.payment_link },
    success: { enabled: true, text: DEFAULT_TEXTS.success },
    expiry: { enabled: true, text: DEFAULT_TEXTS.expiry },
    reject: { enabled: true, text: DEFAULT_TEXTS.reject },
  },
  journal: [],
};

export function normalizeSmsSettings(raw: unknown): SmsSettings {
  const r = (raw ?? {}) as Partial<SmsSettings>;

  const normalizeTemplate = (id: SmsTemplateId, tpl: unknown): SmsTemplateConfig => {
    const t = (tpl ?? {}) as Partial<SmsTemplateConfig>;
    return {
      enabled: t.enabled !== false,
      text:
        typeof t.text === "string" && t.text.trim()
          ? t.text
          : DEFAULT_SMS_SETTINGS.templates[id].text,
    };
  };

  const rawTemplates = (r.templates ?? {}) as Partial<Record<SmsTemplateId, unknown>>;

  return {
    pricePerSegment:
      typeof r.pricePerSegment === "number" && Number.isFinite(r.pricePerSegment)
        ? r.pricePerSegment
        : typeof r.pricePerSegment === "string" && Number.isFinite(Number(r.pricePerSegment))
          ? Number(r.pricePerSegment)
          : DEFAULT_SMS_SETTINGS.pricePerSegment,
    lowBalanceThreshold:
      typeof r.lowBalanceThreshold === "number" && Number.isFinite(r.lowBalanceThreshold)
        ? r.lowBalanceThreshold
        : typeof r.lowBalanceThreshold === "string" &&
            Number.isFinite(Number(r.lowBalanceThreshold))
          ? Number(r.lowBalanceThreshold)
          : DEFAULT_SMS_SETTINGS.lowBalanceThreshold,
    testPhone: typeof r.testPhone === "string" && r.testPhone ? r.testPhone : undefined,
    templates: {
      payment_link: normalizeTemplate("payment_link", rawTemplates.payment_link),
      success: normalizeTemplate("success", rawTemplates.success),
      expiry: normalizeTemplate("expiry", rawTemplates.expiry),
      reject: normalizeTemplate("reject", rawTemplates.reject),
    },
    journal: Array.isArray(r.journal) ? (r.journal as SmsJournalEntry[]) : [],
  };
}

/** Replace {var} placeholders in template text */
export function renderSmsTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

const UK_MONTHS = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
];

function formatDateShortUa(value?: string): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getDate()} ${UK_MONTHS[d.getMonth()]}`;
}

export function buildSmsVarsFromBooking(
  booking: GasBookingRecord,
  extras?: { payUrl?: string; site?: string },
): Record<string, string> {
  const firstName =
    String(booking.name || "Гість")
      .trim()
      .split(/\s+/)[0] || "Гість";

  return {
    name: firstName,
    cottage: booking.cottage || "котедж",
    check_in: formatDateShortUa(booking.checkIn),
    check_out: formatDateShortUa(booking.checkOut),
    pay_url: extras?.payUrl || "",
    order_id: String(booking.id || ""),
    prepay: booking.prepayAmount != null ? `${booking.prepayAmount} грн` : "",
    site: extras?.site || "azhunebi.com",
  };
}

/** Append a new entry to journal array, trimming to max 100. Pure helper. */
export function appendSmsJournalEntry(
  journal: SmsJournalEntry[],
  entry: SmsJournalEntry,
): SmsJournalEntry[] {
  return [entry, ...journal].slice(0, 100);
}
