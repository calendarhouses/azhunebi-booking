import "server-only";

import { loadAllSettings, saveSettingsKey } from "@/lib/db/settings";
import {
  hasPaymentSettingsRecord,
  normalizePaymentSettings,
  type PaymentJournalEntry,
  type PaymentSettingsStored,
  type PaymentWebhookHealth,
} from "./paymentSettings";

const JOURNAL_MAX = 100;

function newId(): string {
  return `pj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readStored(raw: unknown): PaymentSettingsStored & {
  journal: PaymentJournalEntry[];
  webhook: PaymentWebhookHealth;
} {
  const base = hasPaymentSettingsRecord(raw)
    ? normalizePaymentSettings(raw)
    : normalizePaymentSettings({});
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const journal = Array.isArray(obj.journal)
    ? (obj.journal as PaymentJournalEntry[]).slice(0, JOURNAL_MAX)
    : [];
  const webhookRaw =
    obj.webhook && typeof obj.webhook === "object"
      ? (obj.webhook as Partial<PaymentWebhookHealth>)
      : {};
  return {
    ...base,
    journal,
    webhook: {
      lastAt: typeof webhookRaw.lastAt === "string" ? webhookRaw.lastAt : null,
      lastOk: typeof webhookRaw.lastOk === "boolean" ? webhookRaw.lastOk : null,
      lastStatus:
        typeof webhookRaw.lastStatus === "string" ? webhookRaw.lastStatus : null,
      lastChannel:
        webhookRaw.lastChannel === "monopay" || webhookRaw.lastChannel === "monoparts"
          ? webhookRaw.lastChannel
          : null,
    },
  };
}

/** Persist journal entry + optional webhook health touch. Never throws to callers. */
export async function recordPaymentEvent(args: {
  outcome: PaymentJournalEntry["outcome"];
  bookingId: string;
  guestName?: string;
  amount?: number;
  provider?: string;
  transactionId?: string;
  reason?: string;
  channel?: PaymentJournalEntry["channel"];
  touchWebhook?: boolean;
  webhookOk?: boolean;
  webhookStatus?: string;
}): Promise<void> {
  try {
    const all = await loadAllSettings();
    const current = readStored(all.paymentSettings);
    const entry: PaymentJournalEntry = {
      id: newId(),
      at: new Date().toISOString(),
      outcome: args.outcome,
      bookingId: String(args.bookingId || "").trim(),
      guestName: args.guestName?.trim() || undefined,
      amount:
        typeof args.amount === "number" && Number.isFinite(args.amount)
          ? Math.round(args.amount)
          : undefined,
      provider: args.provider?.trim() || undefined,
      transactionId: args.transactionId?.trim() || undefined,
      reason: args.reason?.trim() || undefined,
      channel: args.channel,
    };

    const journal = [entry, ...current.journal]
      .filter((e) => e.bookingId)
      .slice(0, JOURNAL_MAX);

    let webhook = current.webhook;
    if (args.touchWebhook) {
      webhook = {
        lastAt: entry.at,
        lastOk: args.webhookOk ?? args.outcome === "success",
        lastStatus: args.webhookStatus || args.outcome,
        lastChannel:
          args.channel === "monopay" || args.channel === "monoparts"
            ? args.channel
            : webhook.lastChannel,
      };
    }

    const next: PaymentSettingsStored = {
      onlineEnabled: current.onlineEnabled,
      monoPartsEnabled: current.monoPartsEnabled,
      ...(current.monoAcquiringToken
        ? { monoAcquiringToken: current.monoAcquiringToken }
        : {}),
      journal,
      webhook,
    };

    await saveSettingsKey("paymentSettings", next);
  } catch (err) {
    console.warn("[paymentJournal] record failed", err);
  }
}

export async function touchPaymentWebhook(args: {
  ok: boolean;
  status?: string;
  channel: "monopay" | "monoparts";
}): Promise<void> {
  try {
    const all = await loadAllSettings();
    const current = readStored(all.paymentSettings);
    const next: PaymentSettingsStored = {
      onlineEnabled: current.onlineEnabled,
      monoPartsEnabled: current.monoPartsEnabled,
      ...(current.monoAcquiringToken
        ? { monoAcquiringToken: current.monoAcquiringToken }
        : {}),
      journal: current.journal,
      webhook: {
        lastAt: new Date().toISOString(),
        lastOk: args.ok,
        lastStatus: args.status || (args.ok ? "ok" : "error"),
        lastChannel: args.channel,
      },
    };
    await saveSettingsKey("paymentSettings", next);
  } catch (err) {
    console.warn("[paymentJournal] webhook touch failed", err);
  }
}

export function readPaymentJournalFromSettings(raw: unknown): PaymentJournalEntry[] {
  return readStored(raw).journal;
}

export function readPaymentWebhookFromSettings(raw: unknown): PaymentWebhookHealth {
  return readStored(raw).webhook;
}
