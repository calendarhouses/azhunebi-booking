import "server-only";

import { gasPost } from "@/lib/gas-api";
import { type SmsJournalEntry } from "./smsSettings";
import { countSmsSegments, estimateSmsCost } from "./smsSegments";

export function makeSmsJournalEntry(params: {
  type: SmsJournalEntry["type"];
  phone: string;
  text: string;
  ok: boolean;
  messageId?: string | null;
  error?: string;
  bookingId?: string;
  pricePerSegment?: number;
}): SmsJournalEntry {
  const segInfo = countSmsSegments(params.text);
  const pricePerSegment = params.pricePerSegment ?? 1.29;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    type: params.type,
    phone: params.phone,
    text: params.text,
    ok: params.ok,
    messageId: params.messageId ?? null,
    segments: segInfo.segments,
    costEstimate: params.ok ? estimateSmsCost(segInfo.segments, pricePerSegment) : undefined,
    error: params.error,
    bookingId: params.bookingId,
  };
}

/**
 * Persists a journal entry to GAS settings via appendSmsJournal action.
 * Fire-and-forget safe — errors are logged, not thrown.
 */
export async function recordSmsJournalEntry(
  entry: SmsJournalEntry,
  webhookSecret: string,
): Promise<void> {
  try {
    await gasPost<{ success?: boolean }>({
      action: "appendSmsJournal",
      entry,
      webhookSecret,
    });
  } catch (err) {
    console.error("[smsJournal] Failed to persist journal entry", err);
  }
}
