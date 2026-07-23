import { getChangesTargets, isTelegramConfigured } from "./config";
import { escapeHtml, formatDateUk } from "./formatters";
import { sendTelegramMessage } from "./sendMessage";

export type ActivityActor = {
  userId?: string;
  name?: string;
  email?: string;
  role?: string;
};

export type ActivityChangeLine = {
  label?: string;
  from?: string;
  to?: string;
};

export type ActivityEntryNotify = {
  id?: string;
  at?: string;
  type?: string;
  summary?: string;
  actor?: ActivityActor;
  details?: {
    orderId?: string;
    name?: string;
    cottage?: string;
    saveKeys?: string[];
    changes?: ActivityChangeLine[];
  };
};

function roleUk(role?: string): string {
  return role === "admin" ? "адмін" : role === "owner" ? "власник" : "";
}

function actorName(actor?: ActivityActor): string {
  if (!actor) return "Хтось";
  return String(actor.name || actor.email || "Користувач").trim() || "Користувач";
}

function typeMeta(type?: string): { emoji: string; title: string } {
  const t = String(type || "");
  if (t.startsWith("booking.create")) return { emoji: "➕", title: "Нова бронь" };
  if (t.startsWith("booking.update")) return { emoji: "✏️", title: "Бронь оновлено" };
  if (t.startsWith("booking.delete")) return { emoji: "🗑", title: "Бронь видалено" };
  if (t.startsWith("settings")) return { emoji: "⚙️", title: "Налаштування" };
  if (t.startsWith("team.create")) return { emoji: "👥", title: "Команда · додано" };
  if (t.startsWith("team.update")) return { emoji: "👥", title: "Команда · оновлено" };
  if (t.startsWith("team")) return { emoji: "👥", title: "Команда" };
  return { emoji: "📝", title: "Зміна" };
}

function formatWhenShort(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = formatDateUk(d);
  const time = d.toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  });
  return `${day}, ${time}`;
}

function changeLineHtml(change: ActivityChangeLine): string {
  const label = escapeHtml(change.label || "Поле");
  const from = String(change.from || "").trim();
  const to = String(change.to || "").trim();
  if (from && to && from !== "—" && from !== to) {
    return `• <b>${label}</b>: <code>${escapeHtml(from)}</code> → <code>${escapeHtml(to)}</code>`;
  }
  if (to) {
    return `• <b>${label}</b>: <code>${escapeHtml(to)}</code>`;
  }
  return `• <b>${label}</b>`;
}

export function buildActivityChangeCaption(entry: ActivityEntryNotify): string {
  const meta = typeMeta(entry.type);
  const who = escapeHtml(actorName(entry.actor));
  const role = roleUk(entry.actor?.role);
  const summary = escapeHtml(String(entry.summary || "Зміна в адмінці"));
  const details = entry.details || {};
  const changes = Array.isArray(details.changes) ? details.changes.slice(0, 12) : [];

  const lines: string[] = [];
  lines.push(`${meta.emoji} <b>${escapeHtml(meta.title)}</b>`);
  lines.push(`👤 <b>${who}</b>${role ? ` · ${escapeHtml(role)}` : ""}`);

  const contextBits: string[] = [];
  if (details.orderId) contextBits.push(String(details.orderId));
  if (details.name) contextBits.push(String(details.name));
  if (details.cottage) contextBits.push(String(details.cottage));
  if (contextBits.length) {
    lines.push(`🏷 ${escapeHtml(contextBits.join(" · "))}`);
  }

  lines.push("");
  if (changes.length) {
    for (const c of changes) lines.push(changeLineHtml(c));
  } else {
    lines.push(summary);
  }

  const when = formatWhenShort(entry.at);
  if (when) {
    lines.push("");
    lines.push(`🕐 ${escapeHtml(when)}`);
  }

  return lines.join("\n");
}

/** Надсилає запис журналу в тред «Зміни». */
export async function notifyActivityChange(
  entry: ActivityEntryNotify | null | undefined
): Promise<boolean> {
  if (!entry || !isTelegramConfigured()) return false;
  const target = getChangesTargets();
  if (!target) return false;
  const caption = buildActivityChangeCaption(entry);
  const res = await sendTelegramMessage(caption, undefined, target.chatId, target.threadId);
  return Boolean(res.ok);
}
