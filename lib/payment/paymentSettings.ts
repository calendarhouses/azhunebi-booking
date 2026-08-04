/**
 * Online payment settings (Mono acquiring) stored in Supabase `settings.paymentSettings`.
 * The raw token never leaves the server — admin/public payloads get a masked view.
 */

export type PaymentJournalOutcome = "success" | "failure" | "expired";

export type PaymentJournalEntry = {
  id: string;
  at: string;
  outcome: PaymentJournalOutcome;
  bookingId: string;
  guestName?: string;
  amount?: number;
  provider?: string;
  transactionId?: string;
  reason?: string;
  channel?: "monopay" | "monoparts" | "lifecycle";
};

export type PaymentWebhookHealth = {
  lastAt: string | null;
  lastOk: boolean | null;
  lastStatus: string | null;
  lastChannel: "monopay" | "monoparts" | null;
};

export type PaymentSettingsStored = {
  /** When true, guests can land on /pay (unless FORCE_OFF or manual review). */
  onlineEnabled: boolean;
  /** When true and Parts env is configured, show «Покупка частинами» on /pay. */
  monoPartsEnabled: boolean;
  /** How long a pay link stays valid (hours). Default 3. */
  paymentWindowHours?: number;
  /** Mono acquiring X-Token — server-only. */
  monoAcquiringToken?: string;
  /** Newest-first event log (success / decline / expiry). */
  journal?: PaymentJournalEntry[];
  /** Last inbound Mono webhook pulse. */
  webhook?: PaymentWebhookHealth;
};

/** Safe shape for admin UI / client cache (no secret). */
export type PaymentSettingsPublic = {
  onlineEnabled: boolean;
  monoPartsEnabled: boolean;
  paymentWindowHours: number;
  tokenConfigured: boolean;
  tokenLast4: string | null;
  /** True when token comes only from env (not saved in settings yet). */
  tokenFromEnv: boolean;
  /** Env ONLINE_PAYMENT_FORCE_OFF — toggle cannot enable payment. */
  forceOff: boolean;
  /** Env MONO_CHAST_* present. */
  partsConfigured: boolean;
  webhook: PaymentWebhookHealth;
};

export const DEFAULT_PAYMENT_WINDOW_HOURS = 3;
export const PAYMENT_WINDOW_PRESETS = [1, 2, 3, 6, 10, 12, 24] as const;
export const PAYMENT_WINDOW_MIN_HOURS = 1;
export const PAYMENT_WINDOW_MAX_HOURS = 72;

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettingsStored = {
  onlineEnabled: false,
  monoPartsEnabled: true,
  paymentWindowHours: DEFAULT_PAYMENT_WINDOW_HOURS,
  journal: [],
  webhook: {
    lastAt: null,
    lastOk: null,
    lastStatus: null,
    lastChannel: null,
  },
};

export function clampPaymentWindowHours(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return DEFAULT_PAYMENT_WINDOW_HOURS;
  return Math.min(
    PAYMENT_WINDOW_MAX_HOURS,
    Math.max(PAYMENT_WINDOW_MIN_HOURS, n)
  );
}

/** «1 година» / «3 години» / «5 годин» */
export function formatPaymentWindowPhrase(hours: number): string {
  const h = clampPaymentWindowHours(hours);
  const mod10 = h % 10;
  const mod100 = h % 100;
  if (mod10 === 1 && mod100 !== 11) return `${h} година`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${h} години`;
  }
  return `${h} годин`;
}

/** Short label for SMS: «3 год» */
export function formatPaymentWindowShort(hours: number): string {
  return `${clampPaymentWindowHours(hours)} год`;
}

export function resolvePaymentWindowHours(raw: unknown): number {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_PAYMENT_WINDOW_HOURS;
  }
  const o = raw as Record<string, unknown>;
  if (o.paymentWindowHours == null) return DEFAULT_PAYMENT_WINDOW_HOURS;
  return clampPaymentWindowHours(o.paymentWindowHours);
}

function envTruthy(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function isOnlinePaymentForceOff(): boolean {
  return envTruthy(process.env.ONLINE_PAYMENT_FORCE_OFF);
}

export function legacyEnvOnlinePaymentEnabled(): boolean {
  return envTruthy(process.env.NEXT_PUBLIC_ONLINE_PAYMENT_ENABLED);
}

export function envMonoAcquiringToken(): string {
  return process.env.MONO_ACQUIRING_TOKEN?.trim() || "";
}

export function isMonoPartsEnvConfigured(): boolean {
  return Boolean(
    process.env.MONO_CHAST_STORE_ID?.trim() && process.env.MONO_CHAST_SIGN_KEY?.trim()
  );
}

function tokenLast4(token: string): string | null {
  const t = token.trim();
  if (!t) return null;
  return t.slice(-4);
}

/** Whether `paymentSettings` row exists in settings (even if empty object). */
export function hasPaymentSettingsRecord(raw: unknown): boolean {
  return raw != null && typeof raw === "object" && !Array.isArray(raw);
}

function normalizeWebhook(raw: unknown): PaymentWebhookHealth {
  const w =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Partial<PaymentWebhookHealth>)
      : {};
  return {
    lastAt: typeof w.lastAt === "string" ? w.lastAt : null,
    lastOk: typeof w.lastOk === "boolean" ? w.lastOk : null,
    lastStatus: typeof w.lastStatus === "string" ? w.lastStatus : null,
    lastChannel:
      w.lastChannel === "monopay" || w.lastChannel === "monoparts"
        ? w.lastChannel
        : null,
  };
}

function normalizeJournal(raw: unknown): PaymentJournalEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: PaymentJournalEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const e = item as Partial<PaymentJournalEntry>;
    const bookingId = String(e.bookingId || "").trim();
    const at = String(e.at || "").trim();
    const outcome = e.outcome;
    if (!bookingId || !at) continue;
    if (outcome !== "success" && outcome !== "failure" && outcome !== "expired") {
      continue;
    }
    out.push({
      id: String(e.id || `${bookingId}_${at}`),
      at,
      outcome,
      bookingId,
      guestName: typeof e.guestName === "string" ? e.guestName : undefined,
      amount:
        typeof e.amount === "number" && Number.isFinite(e.amount)
          ? Math.round(e.amount)
          : undefined,
      provider: typeof e.provider === "string" ? e.provider : undefined,
      transactionId: typeof e.transactionId === "string" ? e.transactionId : undefined,
      reason: typeof e.reason === "string" ? e.reason : undefined,
      channel:
        e.channel === "monopay" || e.channel === "monoparts" || e.channel === "lifecycle"
          ? e.channel
          : undefined,
    });
    if (out.length >= 100) break;
  }
  return out;
}

export function normalizePaymentSettings(raw: unknown): PaymentSettingsStored {
  let input: unknown = raw;
  for (let i = 0; i < 4 && typeof input === "string"; i += 1) {
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
  const r = input as Partial<PaymentSettingsStored> & Record<string, unknown>;
  const token =
    typeof r.monoAcquiringToken === "string" ? r.monoAcquiringToken.trim() : "";
  return {
    onlineEnabled: Boolean(r.onlineEnabled),
    monoPartsEnabled: r.monoPartsEnabled !== false,
    paymentWindowHours: clampPaymentWindowHours(
      r.paymentWindowHours ?? DEFAULT_PAYMENT_WINDOW_HOURS
    ),
    ...(token ? { monoAcquiringToken: token } : {}),
    journal: normalizeJournal(r.journal),
    webhook: normalizeWebhook(r.webhook),
  };
}

/**
 * Resolve whether public online payment is ON.
 * 1) FORCE_OFF → false
 * 2) paymentSettings present → onlineEnabled
 * 3) else legacy NEXT_PUBLIC_ONLINE_PAYMENT_ENABLED
 */
export function resolveOnlinePaymentEnabled(
  paymentSettingsRaw: unknown,
  opts?: { hasRecord?: boolean }
): boolean {
  if (isOnlinePaymentForceOff()) return false;
  const hasRecord =
    opts?.hasRecord ?? hasPaymentSettingsRecord(paymentSettingsRaw);
  if (hasRecord) {
    return normalizePaymentSettings(paymentSettingsRaw).onlineEnabled;
  }
  return legacyEnvOnlinePaymentEnabled();
}

/** Client-safe: from init / admin settings object. */
export function isOnlinePaymentEnabledFromSettings(
  settings: Record<string, unknown> | null | undefined
): boolean {
  if (!settings) return legacyEnvOnlinePaymentEnabled() && !isOnlinePaymentForceOff();
  if (isOnlinePaymentForceOff()) return false;
  const raw = settings.paymentSettings;
  if (hasPaymentSettingsRecord(raw)) {
    const pub = raw as Partial<PaymentSettingsPublic & PaymentSettingsStored>;
    return Boolean(pub.onlineEnabled);
  }
  return legacyEnvOnlinePaymentEnabled();
}

export function isMonoPartsEnabledFromSettings(
  settings: Record<string, unknown> | null | undefined
): boolean {
  if (!isMonoPartsEnvConfigured()) return false;
  const raw = settings?.paymentSettings;
  if (!hasPaymentSettingsRecord(raw)) return true;
  return normalizePaymentSettings(raw).monoPartsEnabled;
}

/** Strip secret; annotate env fallback for admin UI. */
export function toPublicPaymentSettings(
  raw: unknown,
  opts?: { hasRecord?: boolean }
): PaymentSettingsPublic {
  const hasRecord = opts?.hasRecord ?? hasPaymentSettingsRecord(raw);
  const stored = hasRecord
    ? normalizePaymentSettings(raw)
    : { ...DEFAULT_PAYMENT_SETTINGS };
  const settingsToken = stored.monoAcquiringToken?.trim() || "";
  const envToken = envMonoAcquiringToken();
  const effective = settingsToken || envToken;
  return {
    onlineEnabled: resolveOnlinePaymentEnabled(raw, { hasRecord }),
    monoPartsEnabled: stored.monoPartsEnabled,
    paymentWindowHours: clampPaymentWindowHours(stored.paymentWindowHours),
    tokenConfigured: Boolean(effective),
    tokenLast4: tokenLast4(effective),
    tokenFromEnv: !settingsToken && Boolean(envToken),
    forceOff: isOnlinePaymentForceOff(),
    partsConfigured: isMonoPartsEnvConfigured(),
    webhook: stored.webhook || DEFAULT_PAYMENT_SETTINGS.webhook!,
  };
}

/** Public site init — no token metadata beyond flags guests need. */
export function toPublicInitPaymentSettings(raw: unknown): {
  onlineEnabled: boolean;
  monoPartsEnabled: boolean;
} {
  const pub = toPublicPaymentSettings(raw);
  return {
    onlineEnabled: pub.onlineEnabled,
    monoPartsEnabled: pub.monoPartsEnabled && pub.partsConfigured,
  };
}

/**
 * Merge admin save into stored settings.
 * Empty/missing monoAcquiringToken in incoming → keep existing token.
 */
export function mergePaymentSettingsForSave(
  existingRaw: unknown,
  incomingRaw: unknown
): PaymentSettingsStored {
  const existing = normalizePaymentSettings(existingRaw);
  const incoming = (incomingRaw && typeof incomingRaw === "object"
    ? incomingRaw
    : {}) as Partial<PaymentSettingsStored> & Partial<PaymentSettingsPublic>;

  const nextToken =
    typeof incoming.monoAcquiringToken === "string"
      ? incoming.monoAcquiringToken.trim()
      : "";

  const onlineEnabled =
    typeof incoming.onlineEnabled === "boolean"
      ? incoming.onlineEnabled
      : existing.onlineEnabled;
  const monoPartsEnabled =
    typeof incoming.monoPartsEnabled === "boolean"
      ? incoming.monoPartsEnabled
      : existing.monoPartsEnabled;
  const paymentWindowHours =
    incoming.paymentWindowHours != null
      ? clampPaymentWindowHours(incoming.paymentWindowHours)
      : clampPaymentWindowHours(existing.paymentWindowHours);

  const out: PaymentSettingsStored = {
    onlineEnabled,
    monoPartsEnabled,
    paymentWindowHours,
    journal: existing.journal || [],
    webhook: existing.webhook || DEFAULT_PAYMENT_SETTINGS.webhook,
  };
  if (nextToken) {
    out.monoAcquiringToken = nextToken;
  } else if (existing.monoAcquiringToken) {
    out.monoAcquiringToken = existing.monoAcquiringToken;
  }
  return out;
}

export function resolveMonoAcquiringTokenFromSettings(raw: unknown): string {
  const stored = normalizePaymentSettings(raw).monoAcquiringToken?.trim() || "";
  return stored || envMonoAcquiringToken();
}
