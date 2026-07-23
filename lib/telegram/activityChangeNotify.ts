import { getChangesTargets, isTelegramConfigured } from "./config";
import { escapeHtml } from "./formatters";
import { sendTelegramMessage } from "./sendMessage";

export type ActivityActor = {
  userId?: string;
  name?: string;
  email?: string;
  role?: string;
};

export type ActivityEntryNotify = {
  id?: string;
  at?: string;
  type?: string;
  summary?: string;
  actor?: ActivityActor;
};

function roleUk(role?: string): string {
  return role === "admin" ? "адмін" : role === "owner" ? "власник" : "";
}

function actorLine(actor?: ActivityActor): string {
  if (!actor) return "Хтось";
  const name = String(actor.name || "").trim();
  const email = String(actor.email || "").trim();
  const who = name || email || "Користувач";
  const role = roleUk(actor.role);
  return role ? `${who} (${role})` : who;
}

function typeEmoji(type?: string): string {
  const t = String(type || "");
  if (t.startsWith("booking.create")) return "➕";
  if (t.startsWith("booking.update")) return "✏️";
  if (t.startsWith("booking.delete")) return "🗑";
  if (t.startsWith("settings")) return "⚙️";
  if (t.startsWith("team")) return "👥";
  return "📝";
}

export function buildActivityChangeCaption(entry: ActivityEntryNotify): string {
  const who = escapeHtml(actorLine(entry.actor));
  const summary = escapeHtml(String(entry.summary || "Зміна в адмінці"));
  const emoji = typeEmoji(entry.type);
  return `${emoji} <b>Зміна</b>\n👤 ${who}\n${summary}`;
}

/** Надсилає запис журналу в тред «Зміни». Без треду — тихо no-op. */
export async function notifyActivityChange(
  entry: ActivityEntryNotify | null | undefined
): Promise<boolean> {
  if (!entry || !isTelegramConfigured()) return false;
  const target = getChangesTargets();
  if (!target) return false;
  const caption = buildActivityChangeCaption(entry);
  const res = await sendTelegramMessage(caption, undefined, target.chatId, target.threadId);
  return Boolean(res?.ok);
}
