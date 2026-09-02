import "server-only";

import { serverGasFetch, serverGasPost } from "@/lib/gas-api-server";
import {
  appendSmsJournalEntry,
  mergeSmsJournal,
  normalizeSmsSettings,
  type SmsJournalEntry,
  type SmsSettings,
} from "./smsSettings";

/** Persist journal entry via admin-authenticated saveSettings (reliable). */
export async function persistSmsJournalEntryAdmin(
  entry: SmsJournalEntry,
  options: { authToken: string | null; tenantId: string | null },
): Promise<{ ok: boolean; journal: SmsJournalEntry[]; error?: string }> {
  try {
    const data = await serverGasFetch<{ smsSettings?: unknown }>(
      { action: "settings", tenant_id: options.tenantId || undefined },
      options.authToken || null,
    );
    const settings = normalizeSmsSettings(data.smsSettings);
    const journal = appendSmsJournalEntry(settings.journal, entry);
    return persistSmsJournalBulk(journal, options, settings);
  } catch (err) {
    console.error("[persistSmsJournal] admin save failed", err);
    return {
      ok: false,
      journal: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Replace full journal array (e.g. after status refresh). */
export async function persistSmsJournalBulk(
  journal: SmsJournalEntry[],
  options: { authToken: string | null; tenantId: string | null },
  baseSettings?: SmsSettings,
): Promise<{ ok: boolean; journal: SmsJournalEntry[]; error?: string }> {
  try {
    let settings = baseSettings;
    if (!settings) {
      const data = await serverGasFetch<{ smsSettings?: unknown }>(
        { action: "settings", tenant_id: options.tenantId || undefined },
        options.authToken || null,
      );
      settings = normalizeSmsSettings(data.smsSettings);
    }
    const smsSettings: SmsSettings = { ...settings, journal: journal.slice(0, 100) };

    await serverGasPost(
      {
        action: "saveSettings",
        tenant_id: options.tenantId || undefined,
        settings: { smsSettings },
        saveKeys: ["smsSettings"],
      },
      options.authToken || null,
    );

    return { ok: true, journal: smsSettings.journal };
  } catch (err) {
    console.error("[persistSmsJournal] bulk save failed", err);
    return {
      ok: false,
      journal: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export { mergeSmsJournal };
