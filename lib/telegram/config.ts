const FAKE = "FAKE_TEST_KEY_DO_NOT_TOUCH";

/**
 * Forum topics in TELEGRAM_ADMIN_CHAT_ID (t.me/c/<id_without_-100>/<topic>):
 *   5 — БРОНЮВАННЯ
 *   6 — ФІНАНСИ / ЗВІТИ
 *   7 — ЗАЇЗД / ВИЇЗД
 *   8 — ЗАПИТИ БРОНЮВАННЯ
 *  88 — ЗМІНИ (TELEGRAM_THREAD_CHANGES)
 */
export const TELEGRAM_TOPIC = {
  bookings: 5,
  finance: 6,
  arrivals: 7,
  requests: 8,
  changes: 88,
} as const;

export type TelegramTopicKey = keyof typeof TELEGRAM_TOPIC;

export type TelegramConfig = {
  botToken: string;
  adminChatId: string;
  threadBookings: number;
  threadFinance: number;
  threadArrivals: number;
  threadRequests: number;
  /** Тред «Зміни»; 0 = вимкнено, поки не задано TELEGRAM_THREAD_CHANGES */
  threadChanges: number;
  /** Окрема група клінінгу (без forum topic) */
  cleaningGroupId: string;
  isTestMode: boolean;
  testChatId: string;
  reviewWebhookSecret: string;
  chessboardUrl: string;
};

function parseThreadId(raw: string | undefined, fallback: number): number {
  const n = Number(String(raw || "").trim());
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getTelegramConfig(): TelegramConfig {
  // Booking uses a dedicated bot (@azhunebibooking_bot). Never reuse @azhunebifood_bot —
  // Telegram allows only one webhook URL per bot token.
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || FAKE,
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() || FAKE,
    threadBookings: parseThreadId(
      process.env.TELEGRAM_THREAD_BOOKINGS || process.env.TELEGRAM_ADMIN_OPS_THREAD_ID,
      TELEGRAM_TOPIC.bookings
    ),
    threadFinance: parseThreadId(
      process.env.TELEGRAM_THREAD_FINANCE || process.env.TELEGRAM_ADMIN_FINANCE_THREAD_ID,
      TELEGRAM_TOPIC.finance
    ),
    threadArrivals: parseThreadId(
      process.env.TELEGRAM_THREAD_ARRIVALS,
      TELEGRAM_TOPIC.arrivals
    ),
    threadRequests: parseThreadId(
      process.env.TELEGRAM_THREAD_REQUESTS,
      TELEGRAM_TOPIC.requests
    ),
    threadChanges: parseThreadId(
      process.env.TELEGRAM_THREAD_CHANGES,
      TELEGRAM_TOPIC.changes
    ),
    cleaningGroupId:
      process.env.TELEGRAM_CLEANING_CHAT_ID?.trim() || "-5577418097",
    isTestMode: process.env.TELEGRAM_TEST_MODE === "true",
    testChatId: process.env.TELEGRAM_TEST_CHAT_ID?.trim() || FAKE,
    reviewWebhookSecret:
      process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
      process.env.TELEGRAM_BOT_TOKEN?.trim() ||
      FAKE,
    chessboardUrl:
      process.env.TELEGRAM_CHESSBOARD_URL?.trim() || "https://admin.azhunebi.com",
  };
}

export function isTelegramConfigured(): boolean {
  const cfg = getTelegramConfig();
  return (
    cfg.botToken !== FAKE &&
    !cfg.botToken.includes("FAKE") &&
    cfg.adminChatId !== FAKE &&
    !cfg.adminChatId.includes("FAKE")
  );
}

export type TelegramTarget = { chatId: string; threadId: number | null };

function targetForThread(threadId: number): TelegramTarget {
  const cfg = getTelegramConfig();
  if (cfg.isTestMode) return { chatId: cfg.testChatId, threadId: null };
  return { chatId: cfg.adminChatId, threadId };
}

/** БРОНЮВАННЯ — нові / оплачені броні */
export function getBookingsTargets(): TelegramTarget {
  return targetForThread(getTelegramConfig().threadBookings);
}

/** ЗАПИТИ БРОНЮВАННЯ — pending review */
export function getRequestsTargets(): TelegramTarget {
  return targetForThread(getTelegramConfig().threadRequests);
}

/** ЗАЇЗД / ВИЇЗД */
export function getArrivalsTargets(): TelegramTarget {
  return targetForThread(getTelegramConfig().threadArrivals);
}

/** ФІНАНСИ / ЗВІТИ */
export function getFinanceTargets(): TelegramTarget {
  return targetForThread(getTelegramConfig().threadFinance);
}

/** ЗМІНИ — дії команди в адмінці. */
export function getChangesTargets(): TelegramTarget | null {
  const id = getTelegramConfig().threadChanges;
  if (!id) return null;
  return targetForThread(id);
}

/** Група клінінгу — сповіщення про заїзди */
export function getCleaningTargets(): TelegramTarget {
  const cfg = getTelegramConfig();
  if (cfg.isTestMode) return { chatId: cfg.testChatId, threadId: null };
  return { chatId: cfg.cleaningGroupId, threadId: null };
}

export function isCleaningConfigured(): boolean {
  const id = getTelegramConfig().cleaningGroupId;
  return id !== FAKE && !id.includes("FAKE") && id.length > 0;
}

/** @deprecated use getBookingsTargets */
export function getAdminOpsTargets(): TelegramTarget {
  return getBookingsTargets();
}

export function chessboardKeyboard() {
  const url = getTelegramConfig().chessboardUrl;
  return {
    inline_keyboard: [[{ text: "📅 Шахматка", url }]],
  };
}
