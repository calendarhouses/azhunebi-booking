import {
  getBookingsTargets,
  getTelegramConfig,
  type TelegramTarget,
} from "./config";

export async function sendTelegramMessage(
  text: string,
  keyboard?: unknown,
  chatId?: string,
  threadId?: number | null
): Promise<Response> {
  const cfg = getTelegramConfig();
  const fallback = getBookingsTargets();
  const cid = chatId || fallback.chatId;
  let tid = threadId;
  if (tid === undefined) tid = fallback.threadId;

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

export async function sendTelegramPhotoBase64(
  base64DataUrl: string,
  caption: string,
  keyboard?: unknown,
  target?: TelegramTarget
): Promise<Response> {
  const cfg = getTelegramConfig();
  const dest = target || getBookingsTargets();
  const raw = base64DataUrl.includes(",")
    ? base64DataUrl.split(",")[1]
    : base64DataUrl;
  const buffer = Buffer.from(raw, "base64");
  const form = new FormData();
  form.append("chat_id", dest.chatId);
  if (dest.threadId) form.append("message_thread_id", String(dest.threadId));
  form.append("photo", new Blob([buffer], { type: "image/png" }), "card.png");
  if (caption) {
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
  }
  if (keyboard) form.append("reply_markup", JSON.stringify(keyboard));

  return fetch(`https://api.telegram.org/bot${cfg.botToken}/sendPhoto`, {
    method: "POST",
    body: form,
  });
}

export async function sendTelegramPhotoUrl(
  photoUrl: string,
  caption: string,
  keyboard?: unknown,
  target?: TelegramTarget
): Promise<Response> {
  const cfg = getTelegramConfig();
  const dest = target || getBookingsTargets();
  const payload: Record<string, unknown> = {
    chat_id: dest.chatId,
    photo: photoUrl,
    caption,
    parse_mode: "HTML",
  };
  if (dest.threadId) payload.message_thread_id = dest.threadId;
  if (keyboard) payload.reply_markup = keyboard;

  return fetch(`https://api.telegram.org/bot${cfg.botToken}/sendPhoto`, {
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
  const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    // Telegram returns JSON even for 4xx; read it to expose the real reason.
    const body = await res.json().catch(() => null);
    const desc =
      (body && typeof body === "object" && (body as any).description) ||
      (body && typeof body === "object" && (body as any).error) ||
      res.statusText ||
      `HTTP ${res.status}`;
    throw new Error(desc);
  }
}
