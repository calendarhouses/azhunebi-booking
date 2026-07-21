import "server-only";

import { gasFetch, gasPost } from "@/lib/gas-api";
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
    const data = await gasFetch<{ smsSettings?: unknown }>(
      { action: "settings", tenant_id: options.tenantId || undefined },
      { authToken: options.authToken || undefined },
    );
    const settings = normalizeSmsSettings(data.smsSettings);
    const journal = appendSmsJournalEntry(settings.journal, entry);
    const smsSettings: SmsSettings = { ...settings, journal };

    await gasPost(
      {
        action: "saveSettings",
        tenant_id: options.tenantId || undefined,
        settings: { smsSettings },
        saveKeys: ["smsSettings"],
      },
      { authToken: options.authToken || undefined },
    );

    return { ok: true, journal };
  } catch (err) {
    console.error("[persistSmsJournal] admin save failed", err);
    return {
      ok: false,
      journal: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export { mergeSmsJournal };
