import { getAdminOpsTargets, getTelegramConfig } from "./config";

export async function sendTelegramMessage(
  text: string,
  keyboard?: unknown,
  chatId?: string,
  threadId?: number | null
): Promise<Response> {
  const cfg = getTelegramConfig();
  const ops = getAdminOpsTargets();
  const cid = chatId || ops.chatId;
  let tid = threadId;
  if (tid === undefined) tid = ops.threadId;

  const payload: Record<string, unknown> = {
    chat_id: cid,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (tid) payload.message_thread_id = tid;
  if (keyboard) payload.reply_markup = keyboard;

  return fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function answerTelegramCallback(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  const cfg = getTelegramConfig();
  await fetch(`https://api.telegram.org/bot${cfg.botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text || "",
      show_alert: Boolean(text),
    }),
  });
}

export async function editTelegramMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  keyboard?: unknown
): Promise<void> {
  const cfg = getTelegramConfig();
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (keyboard) payload.reply_markup = keyboard;
  await fetch(`https://api.telegram.org/bot${cfg.botToken}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
