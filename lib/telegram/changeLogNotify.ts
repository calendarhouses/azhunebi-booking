import "server-only";

import type { BookingChangeLine } from "@/lib/db/bookingChangeHistory";
import { guestCottageLabel } from "@/lib/sms/guestCottageLabel";
import { getChangesTargets, isTelegramConfigured } from "./config";
import { escapeHtml, formatDateUk } from "./formatters";
import { sendTelegramMessage } from "./sendMessage";

const ROLE_UK: Record<string, string> = {
  owner: "власник",
  admin: "адміністратор",
};

function parseMoney(raw: string): number {
  const n = Number(String(raw || "").replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function isCancelStatus(value: string): boolean {
  return /скас/i.test(value);
}

function prettyChangeValue(label: string, raw: string): string {
  const s = String(raw || "").trim() || "—";
  if (label === "Дати") {
    return s.replace(/\d{4}-\d{2}-\d{2}/g, (iso) => formatDateUk(iso));
  }
  return s;
}

/** Only dates, status, cancellations and money returned — not every drawer field. */
export function filterChangesForTelegram(
  changes: BookingChangeLine[]
): BookingChangeLine[] {
  const out: BookingChangeLine[] = [];
  for (const ch of changes) {
    const label = String(ch.label || "").trim();
    if (label === "Дати" || label === "Статус") {
      out.push(ch);
      continue;
    }
    if (label === "Оплачено" || label === "Аванс" || label === "Доплата") {
      if (parseMoney(ch.to) < parseMoney(ch.from)) out.push(ch);
    }
  }
  return out;
}

function formatWhenKyiv(at = new Date()): string {
  return at.toLocaleString("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleLabel(role?: string | null): string {
  const key = String(role || "").trim().toLowerCase();
  return ROLE_UK[key] || "";
}

function actorLine(name?: string | null, role?: string | null): string {
  const who = escapeHtml(String(name || "система").trim() || "система");
  const r = roleLabel(role);
  return r ? `👤 ${who} · ${escapeHtml(r)}` : `👤 ${who}`;
}

export type ChangeLogBooking = {
  id?: unknown;
  name?: unknown;
  cottage?: unknown;
  roomId?: unknown;
  checkIn?: unknown;
  checkOut?: unknown;
};

export function buildChangeLogCaption(opts: {
  title: string;
  titleEmoji: string;
  actorName?: string | null;
  actorRole?: string | null;
  booking: ChangeLogBooking;
  cottage?: string;
  lines: BookingChangeLine[];
  at?: Date;
}): string {
  const id = String(opts.booking.id || "").trim();
  const guest = escapeHtml(String(opts.booking.name || "Гість").trim() || "Гість");
  const cottage = escapeHtml(
    String(opts.cottage || opts.booking.cottage || "—").trim() || "—"
  );
  const tagBits = [
    id ? `<code>${escapeHtml(id)}</code>` : "",
    guest,
    cottage,
  ].filter(Boolean);

  const bullets = opts.lines.map((ch) => {
    const label = escapeHtml(ch.label);
    const from = escapeHtml(prettyChangeValue(ch.label, ch.from));
    const to = escapeHtml(prettyChangeValue(ch.label, ch.to));
    if (!ch.from) return `• <b>${label}:</b> ${to}`;
    return `• <b>${label}:</b> ${from} -> ${to}`;
  });

  return [
    `${opts.titleEmoji} <b>${escapeHtml(opts.title)}</b>`,
    actorLine(opts.actorName, opts.actorRole),
    `🏷️ ${tagBits.join(" · ")}`,
    ...bullets,
    `🕓 ${formatWhenKyiv(opts.at)}`,
  ].join("\n");
}

function titleForLines(lines: BookingChangeLine[]): {
  title: string;
  titleEmoji: string;
} {
  const status = lines.find((l) => l.label === "Статус");
  const refund = lines.some(
    (l) =>
      l.label === "Оплачено" || l.label === "Аванс" || l.label === "Доплата"
  );
  if (status && isCancelStatus(status.to)) {
    return { title: "Бронь скасовано", titleEmoji: "❌" };
  }
  if (refund && !status && !lines.some((l) => l.label === "Дати")) {
    return { title: "Повернення коштів", titleEmoji: "💸" };
  }
  return { title: "Бронь оновлено", titleEmoji: "✏️" };
}

async function sendChangeCaption(caption: string): Promise<void> {
  if (!isTelegramConfigured()) return;
  const target = getChangesTargets();
  if (!target) return;
  try {
    await sendTelegramMessage(caption, null, target.chatId, target.threadId);
  } catch (err) {
    console.warn("[TG change log] send failed", err);
  }
}

export async function notifyBookingChangeLog(opts: {
  booking: ChangeLogBooking;
  changes: BookingChangeLine[];
  actorName?: string | null;
  actorRole?: string | null;
}): Promise<void> {
  const lines = filterChangesForTelegram(opts.changes);
  if (!lines.length) return;
  const cottage = await guestCottageLabel({
    cottage: opts.booking.cottage != null ? String(opts.booking.cottage) : "",
    roomId:
      opts.booking.roomId != null
        ? (opts.booking.roomId as string | number)
        : undefined,
  });
  const { title, titleEmoji } = titleForLines(lines);
  await sendChangeCaption(
    buildChangeLogCaption({
      title,
      titleEmoji,
      actorName: opts.actorName,
      actorRole: opts.actorRole,
      booking: opts.booking,
      cottage,
      lines,
    })
  );
}

export async function notifyBookingDeletedLog(opts: {
  booking: ChangeLogBooking;
  actorName?: string | null;
  actorRole?: string | null;
}): Promise<void> {
  const cottage = await guestCottageLabel({
    cottage: opts.booking.cottage != null ? String(opts.booking.cottage) : "",
    roomId:
      opts.booking.roomId != null
        ? (opts.booking.roomId as string | number)
        : undefined,
  });
  const checkIn = String(opts.booking.checkIn || "");
  const checkOut = String(opts.booking.checkOut || "");
  const lines: BookingChangeLine[] = [];
  if (checkIn || checkOut) {
    lines.push({
      label: "Дати",
      from: "",
      to: `${checkIn || "—"} → ${checkOut || "—"}`,
    });
  }
  await sendChangeCaption(
    buildChangeLogCaption({
      title: "Бронь видалено",
      titleEmoji: "🗑️",
      actorName: opts.actorName,
      actorRole: opts.actorRole,
      booking: opts.booking,
      cottage,
      lines,
    })
  );
}

export async function notifyBookingRefundLog(opts: {
  booking: ChangeLogBooking;
  amount: number;
  paidFrom: number;
  paidTo: number;
  cancelled?: boolean;
  actorName?: string | null;
  actorRole?: string | null;
}): Promise<void> {
  const money = (n: number) => `${Math.round(n).toLocaleString("uk-UA")} ₴`;
  const lines: BookingChangeLine[] = [];
  if (opts.cancelled) {
    lines.push({ label: "Статус", from: "—", to: "Скасовано" });
  }
  lines.push(
    { label: "Оплачено", from: money(opts.paidFrom), to: money(opts.paidTo) },
    { label: "Повернення", from: "", to: money(opts.amount) }
  );
  const cottage = await guestCottageLabel({
    cottage: opts.booking.cottage != null ? String(opts.booking.cottage) : "",
    roomId:
      opts.booking.roomId != null
        ? (opts.booking.roomId as string | number)
        : undefined,
  });
  await sendChangeCaption(
    buildChangeLogCaption({
      title: opts.cancelled ? "Бронь скасовано" : "Повернення коштів",
      titleEmoji: opts.cancelled ? "❌" : "💸",
      actorName: opts.actorName,
      actorRole: opts.actorRole,
      booking: opts.booking,
      cottage,
      lines,
    })
  );
}
