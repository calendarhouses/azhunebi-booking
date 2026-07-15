const FAKE = "FAKE_TEST_KEY_DO_NOT_TOUCH";

export type TelegramConfig = {
  botToken: string;
  adminChatId: string;
  adminOpsThreadId: number | null;
  cleaningGroupId: string;
  adminFinanceThreadId: number | null;
  isTestMode: boolean;
  testChatId: string;
  reviewWebhookSecret: string;
};

export function getTelegramConfig(): TelegramConfig {
  const opsThread = process.env.TELEGRAM_ADMIN_OPS_THREAD_ID?.trim();
  const financeThread = process.env.TELEGRAM_ADMIN_FINANCE_THREAD_ID?.trim();
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || FAKE,
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() || FAKE,
    adminOpsThreadId: opsThread ? Number(opsThread) : null,
    cleaningGroupId: process.env.TELEGRAM_CLEANING_CHAT_ID?.trim() || FAKE,
    adminFinanceThreadId: financeThread ? Number(financeThread) : null,
    isTestMode: process.env.TELEGRAM_TEST_MODE === "true",
    testChatId: process.env.TELEGRAM_TEST_CHAT_ID?.trim() || FAKE,
    reviewWebhookSecret:
      process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
      process.env.TELEGRAM_BOT_TOKEN?.trim() ||
      FAKE,
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

export function getAdminOpsTargets(): { chatId: string; threadId: number | null } {
  const cfg = getTelegramConfig();
  if (cfg.isTestMode) return { chatId: cfg.testChatId, threadId: null };
  return { chatId: cfg.adminChatId, threadId: cfg.adminOpsThreadId };
}
