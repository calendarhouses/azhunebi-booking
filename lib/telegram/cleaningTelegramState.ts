import "server-only";

/**
 * Persist Telegram message IDs for today's cleaning turnover sync
 * (edit / delete / send) via GAS Script Properties.
 */

export type CleaningTelegramMessageEntry = {
  messageId: number;
  text: string;
};

export type CleaningTelegramState = {
  date: string;
  chatId: string;
  messages: Record<string, CleaningTelegramMessageEntry>;
};

function emptyState(date = "", chatId = ""): CleaningTelegramState {
  return { date, chatId, messages: {} };
}

function normalizeState(raw: unknown): CleaningTelegramState {
  if (!raw || typeof raw !== "object") return emptyState();
  const obj = raw as Record<string, unknown>;
  const date = String(obj.date || "").trim();
  const chatId = String(obj.chatId || "").trim();
  const messages: Record<string, CleaningTelegramMessageEntry> = {};
  const rawMessages =
    obj.messages && typeof obj.messages === "object"
      ? (obj.messages as Record<string, unknown>)
      : {};
  for (const [key, value] of Object.entries(rawMessages)) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    const messageId = Number(entry.messageId);
    const text = String(entry.text || "");
    if (!Number.isFinite(messageId) || messageId <= 0) continue;
    messages[String(key)] = { messageId, text };
  }
  return { date, chatId, messages };
}

function webhookSecret(): string {
  return (
    process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    ""
  );
}

async function postGasAction<T>(
  action: string,
  extra?: Record<string, unknown>
): Promise<T> {
  const gasUrl = process.env.NEXT_PUBLIC_GAS_URL?.trim();
  if (!gasUrl) throw new Error("NEXT_PUBLIC_GAS_URL is not set");
  const secret = webhookSecret();
  if (!secret) throw new Error("TELEGRAM_REVIEW_WEBHOOK_SECRET is not set");

  const res = await fetch(gasUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action,
      webhookSecret: secret,
      ...extra,
    }),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!res.ok || !json || json.error) {
    throw new Error(json?.error || `GAS ${action} failed (${res.status})`);
  }
  return json;
}

export async function fetchCleaningTelegramState(): Promise<CleaningTelegramState> {
  const json = await postGasAction<{ state?: unknown; status?: string }>(
    "getCleaningTelegramState"
  );
  if (!("state" in json)) {
    throw new Error(
      "GAS action getCleaningTelegramState не знайдено — задеплой azhunebi-script"
    );
  }
  return normalizeState(json.state);
}

export async function saveCleaningTelegramState(
  state: CleaningTelegramState
): Promise<void> {
  const json = await postGasAction<{ ok?: boolean; status?: string }>(
    "saveCleaningTelegramState",
    {
      state: {
        date: state.date,
        chatId: state.chatId,
        messages: state.messages,
      },
    }
  );
  if (!json.ok) {
    throw new Error(
      "GAS action saveCleaningTelegramState не зберегла стан — задеплой azhunebi-script"
    );
  }
}

/** State for today in the cleaning chat; wipe if date/chat changed. */
export function stateForToday(
  loaded: CleaningTelegramState,
  today: string,
  chatId: string
): CleaningTelegramState {
  if (loaded.date === today && loaded.chatId === chatId) {
    return {
      date: today,
      chatId,
      messages: { ...loaded.messages },
    };
  }
  return emptyState(today, chatId);
}
