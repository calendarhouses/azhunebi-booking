import { listBookings } from "@/lib/db/bookings";
import { loadAllSettings, saveSettingsKey } from "@/lib/db/settings";
import { isPendingReviewStatus } from "@/lib/public-booking/bookingReview";
import { getRequestsTargets, isTelegramConfigured } from "./config";
import { deleteTelegramMessage, sendTelegramMessage } from "./sendMessage";

const SETTINGS_KEY = "telegramPendingReviewReminders";
const MAX_STORED = 80;

export type PendingReviewReminderResult = {
  ok: boolean;
  count: number;
  sent: boolean;
  orderIds: string[];
  error?: string;
};

type ReminderRef = { chatId: string; messageId: number };

function requestWord(n: number): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return "запит";
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return "запити";
  return "запитів";
}

export function buildPendingReviewReminderCaption(count: number): string {
  const n = Math.max(1, Math.round(count));
  const verb = n === 1 ? "чекає" : "чекають";
  return `🔔 Нагадування: ${n} ${requestWord(n)} ${verb} підтвердження`;
}

function parseStored(raw: unknown): ReminderRef[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { messages?: unknown }).messages)
      ? (raw as { messages: unknown[] }).messages
      : [];
  const out: ReminderRef[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const chatId = String((item as ReminderRef).chatId || "").trim();
    const messageId = Number((item as ReminderRef).messageId);
    if (!chatId || !Number.isFinite(messageId) || messageId <= 0) continue;
    out.push({ chatId, messageId });
  }
  return out;
}

async function readStoredReminders(): Promise<ReminderRef[]> {
  const settings = await loadAllSettings();
  return parseStored(settings[SETTINGS_KEY]);
}

async function writeStoredReminders(messages: ReminderRef[]): Promise<void> {
  await saveSettingsKey(SETTINGS_KEY, { messages });
}

async function rememberReminder(ref: ReminderRef): Promise<void> {
  const current = await readStoredReminders();
  const next = [...current.filter((m) => !(m.chatId === ref.chatId && m.messageId === ref.messageId)), ref];
  await writeStoredReminders(next.slice(-MAX_STORED));
}

/** Delete every stored reminder ping after a review decision. */
export async function deleteStoredPendingReviewReminders(): Promise<number> {
  const stored = await readStoredReminders();
  if (!stored.length) return 0;
  let deleted = 0;
  for (const ref of stored) {
    try {
      await deleteTelegramMessage(ref.chatId, ref.messageId);
      deleted += 1;
    } catch (err) {
      console.warn("[TG] pending review reminder delete failed", {
        chatId: ref.chatId,
        messageId: ref.messageId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  await writeStoredReminders([]);
  return deleted;
}

/** Ping the requests thread while any booking still awaits admin review. */
export async function sendPendingReviewReminders(): Promise<PendingReviewReminderResult> {
  const all = await listBookings();
  const pending = all.filter((b) => isPendingReviewStatus(String(b.status || "")));
  const orderIds = pending.map((b) => String(b.id || "")).filter(Boolean);

  if (!orderIds.length) {
    return { ok: true, count: 0, sent: false, orderIds: [] };
  }

  if (!isTelegramConfigured()) {
    return {
      ok: false,
      count: pending.length,
      sent: false,
      orderIds,
      error: "TELEGRAM_NOT_CONFIGURED",
    };
  }

  const caption = buildPendingReviewReminderCaption(pending.length);
  const target = getRequestsTargets();
  const res = await sendTelegramMessage(caption, undefined, target.chatId, target.threadId);
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    result?: { message_id?: number; chat?: { id?: string | number } };
    description?: string;
  } | null;
  if (!res.ok || json?.ok === false) {
    const err = json?.description || `telegram ${res.status}`;
    console.error("[TG] pending review reminder failed:", err);
    return {
      ok: false,
      count: pending.length,
      sent: false,
      orderIds,
      error: err,
    };
  }

  const messageId = Number(json?.result?.message_id);
  const chatId = String(json?.result?.chat?.id || target.chatId || "");
  if (Number.isFinite(messageId) && messageId > 0 && chatId) {
    try {
      await rememberReminder({ chatId, messageId });
    } catch (err) {
      console.warn("[TG] pending review reminder id persist failed", err);
    }
  }

  return { ok: true, count: pending.length, sent: true, orderIds };
}
