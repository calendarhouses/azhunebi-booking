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

/** Усі змінні для будь-якого шаблону SMS */
export const SMS_TEMPLATE_VARIABLES: { key: string; label: string }[] = [
  { key: "name", label: "Ім'я гостя" },
  { key: "cottage", label: "Назва котеджу" },
  { key: "check_in", label: "Дата заїзду" },
  { key: "check_out", label: "Дата виїзду" },
  { key: "pay_url", label: "Посилання на оплату" },
  { key: "order_id", label: "Номер бронювання" },
  { key: "prepay", label: "Сума передоплати" },
  { key: "hours", label: "Вікно оплати (коротко, напр. 3 год)" },
  { key: "hours_phrase", label: "Вікно оплати (3 години)" },
  { key: "site", label: "Сайт" },
];

export const SMS_TEMPLATE_META: Record<
  SmsTemplateId,
  { title: string; when: string; variables: { key: string; label: string }[] }
> = {
  payment_link: {
    title: "Посилання на оплату",
    when: "Після створення резерву (очікує оплату)",
    variables: SMS_TEMPLATE_VARIABLES,
  },
  success: {
    title: "Підтвердження бронювання",
    when: "Після отримання передоплати",
    variables: SMS_TEMPLATE_VARIABLES,
  },
  expiry: {
    title: "Скасування резерву",
    when: "Після закінчення часу на оплату",
    variables: SMS_TEMPLATE_VARIABLES,
  },
  reject: {
    title: "Відмова в бронюванні",
    when: "Після рішення адміністратора відхилити бронь",
    variables: SMS_TEMPLATE_VARIABLES,
  },
};

const DEFAULT_TEXTS: Record<SmsTemplateId, string> = {
  payment_link: "Оплата резерву ({hours}): {pay_url}",
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
  let input: unknown = raw;
  // Recover from migrate/Sheets corruption (double-encoded JSON string).
  for (let i = 0; i < 8 && typeof input === "string"; i += 1) {
    const s = input.trim();
    if (!s) {
      input = {};
      break;
    }
    try {
      input = JSON.parse(s);
    } catch {
      input = {};
      break;
    }
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    input = {};
  }

  const r = input as Partial<SmsSettings>;

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
    journal: Array.isArray(r.journal) ? (r.journal as SmsJournalEntry[]).slice(0, 100) : [],
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
  extras?: {
    payUrl?: string;
    site?: string;
    cottage?: string;
    hours?: number;
    hoursPhrase?: string;
  },
): Record<string, string> {
  const firstName =
    String(booking.name || "Гість")
      .trim()
      .split(/\s+/)[0] || "Гість";

  const hoursShort =
    extras?.hours != null && Number.isFinite(extras.hours)
      ? `${Math.round(extras.hours)} год`
      : "3 год";
  const hoursPhrase = extras?.hoursPhrase || hoursShort;

  return {
    name: firstName,
    cottage: extras?.cottage || booking.cottage || "котедж",
    check_in: formatDateShortUa(booking.checkIn),
    check_out: formatDateShortUa(booking.checkOut),
    pay_url: extras?.payUrl || "",
    order_id: String(booking.id || ""),
    prepay: booking.prepayAmount != null ? `${booking.prepayAmount} грн` : "",
    hours: hoursShort,
    hours_phrase: hoursPhrase,
    site: extras?.site || "azhunebi.com",
  };
}

/**
 * Keep hardcoded «(N год)» in payment_link SMS in sync with payment window,
 * or leave `{hours}` placeholder as-is.
 */
export function syncPaymentLinkSmsWindowHours(
  text: string,
  hours: number
): string {
  const h = Math.max(1, Math.min(72, Math.round(Number(hours) || 3)));
  const short = `${h} год`;
  if (/\{hours\}/i.test(text)) return text;
  return text.replace(/\(\d+\s*год(?:ина|ини|ин)?\)/gi, `(${short})`);
}

/** Append a new entry to journal array, trimming to max 100. Pure helper. */
export function appendSmsJournalEntry(
  journal: SmsJournalEntry[],
  entry: SmsJournalEntry,
): SmsJournalEntry[] {
  return [entry, ...journal].slice(0, 100);
}

/** Merge journal lists by id, newest first, max 100. */
export function mergeSmsJournal(...lists: SmsJournalEntry[][]): SmsJournalEntry[] {
  const byId = new Map<string, SmsJournalEntry>();
  for (const list of lists) {
    for (const entry of list) {
      if (entry?.id) byId.set(entry.id, entry);
    }
  }
  return [...byId.values()]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 100);
}
