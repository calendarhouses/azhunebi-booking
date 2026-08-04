/**
 * Online payment settings (Mono acquiring) stored in Supabase `settings.paymentSettings`.
 * The raw token never leaves the server — admin/public payloads get a masked view.
 */

export type PaymentSettingsStored = {
  /** When true, guests can land on /pay (unless FORCE_OFF or manual review). */
  onlineEnabled: boolean;
  /** When true and Parts env is configured, show «Покупка частинами» on /pay. */
  monoPartsEnabled: boolean;
  /** Mono acquiring X-Token — server-only. */
  monoAcquiringToken?: string;
};

/** Safe shape for admin UI / client cache (no secret). */
export type PaymentSettingsPublic = {
  onlineEnabled: boolean;
  monoPartsEnabled: boolean;
  tokenConfigured: boolean;
  tokenLast4: string | null;
  /** True when token comes only from env (not saved in settings yet). */
  tokenFromEnv: boolean;
  /** Env ONLINE_PAYMENT_FORCE_OFF — toggle cannot enable payment. */
  forceOff: boolean;
  /** Env MONO_CHAST_* present. */
  partsConfigured: boolean;
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettingsStored = {
  onlineEnabled: false,
  monoPartsEnabled: true,
};

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
  const r = input as Partial<PaymentSettingsStored>;
  const token =
    typeof r.monoAcquiringToken === "string" ? r.monoAcquiringToken.trim() : "";
  return {
    onlineEnabled: Boolean(r.onlineEnabled),
    monoPartsEnabled: r.monoPartsEnabled !== false,
    ...(token ? { monoAcquiringToken: token } : {}),
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
    tokenConfigured: Boolean(effective),
    tokenLast4: tokenLast4(effective),
    tokenFromEnv: !settingsToken && Boolean(envToken),
    forceOff: isOnlinePaymentForceOff(),
    partsConfigured: isMonoPartsEnvConfigured(),
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

  const out: PaymentSettingsStored = {
    onlineEnabled,
    monoPartsEnabled,
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
