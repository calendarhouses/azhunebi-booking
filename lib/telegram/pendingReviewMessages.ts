import { loadAllSettings, saveSettingsKey } from "@/lib/db/settings";
import { editTelegramMessage } from "./sendMessage";

const SETTINGS_KEY = "telegramPendingReviewMessages";
const MAX_STORED = 120;

export type PendingReviewMessageRef = {
  orderId: string;
  chatId: string;
  messageId: number;
};

function parseStored(raw: unknown): PendingReviewMessageRef[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { messages?: unknown }).messages)
      ? (raw as { messages: unknown[] }).messages
      : [];
  const out: PendingReviewMessageRef[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const orderId = String((item as PendingReviewMessageRef).orderId || "").trim();
    const chatId = String((item as PendingReviewMessageRef).chatId || "").trim();
    const messageId = Number((item as PendingReviewMessageRef).messageId);
    if (!orderId || !chatId || !Number.isFinite(messageId) || messageId <= 0) continue;
    out.push({ orderId, chatId, messageId });
  }
  return out;
}

async function readStored(): Promise<PendingReviewMessageRef[]> {
  const settings = await loadAllSettings();
  return parseStored(settings[SETTINGS_KEY]);
}

async function writeStored(messages: PendingReviewMessageRef[]): Promise<void> {
  await saveSettingsKey(SETTINGS_KEY, { messages });
}

/** Remember the accept/reject Telegram message for a pending booking. */
export async function rememberPendingReviewMessage(
  ref: PendingReviewMessageRef
): Promise<void> {
  const orderId = ref.orderId.trim();
  const chatId = String(ref.chatId || "").trim();
  const messageId = Number(ref.messageId);
  if (!orderId || !chatId || !Number.isFinite(messageId) || messageId <= 0) return;

  const current = await readStored();
  const next = [
    ...current.filter(
      (m) =>
        !(
          m.orderId === orderId &&
          m.chatId === chatId &&
          m.messageId === messageId
        )
    ),
    { orderId, chatId, messageId },
  ];
  await writeStored(next.slice(-MAX_STORED));
}

export async function clearPendingReviewMessagesForOrder(
  orderId: string
): Promise<void> {
  const id = orderId.trim();
  if (!id) return;
  const current = await readStored();
  const next = current.filter((m) => m.orderId !== id);
  if (next.length === current.length) return;
  await writeStored(next);
}

/**
 * Edit stored (and optional source) Telegram review messages: remove buttons,
 * show decision + SMS status. Safe to call from admin or Telegram paths.
 */
export async function finalizePendingReviewTelegramMessages(params: {
  orderId: string;
  decision: "approve" | "reject";
  bodyHtml: string;
  alsoEdit?: { chatId: string | number; messageId: number };
}): Promise<number> {
  const orderId = params.orderId.trim();
  if (!orderId) return 0;

  const stored = await readStored();
  const targets = new Map<string, PendingReviewMessageRef>();

  for (const ref of stored) {
    if (ref.orderId !== orderId) continue;
    targets.set(`${ref.chatId}:${ref.messageId}`, ref);
  }

  if (params.alsoEdit) {
    const chatId = String(params.alsoEdit.chatId || "").trim();
    const messageId = Number(params.alsoEdit.messageId);
    if (chatId && Number.isFinite(messageId) && messageId > 0) {
      targets.set(`${chatId}:${messageId}`, { orderId, chatId, messageId });
    }
  }

  let edited = 0;
  for (const ref of targets.values()) {
    try {
      await editTelegramMessage(ref.chatId, ref.messageId, params.bodyHtml, {
        inline_keyboard: [],
      });
      edited += 1;
    } catch (err) {
      console.warn("[TG] pending review finalize edit failed", {
        orderId,
        chatId: ref.chatId,
        messageId: ref.messageId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await clearPendingReviewMessagesForOrder(orderId);
  return edited;
}
