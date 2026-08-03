#!/usr/bin/env node
/**
 * Шле сьогоднішні сповіщення в ПРИБИРАННЯ — окреме повідомлення на кожен будиночок.
 *
 * Usage (з azhunebi-booking):
 *   npm run telegram:cleaning-today
 *   npm run telegram:cleaning-today -- --via-cron          # через Next cron (потрібен CRON_SECRET)
 *   npm run telegram:cleaning-today -- --via-cron --local
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(resolve(root, ".env.local"));
loadEnvFile(resolve(root, ".env"));

function todayKeyKyiv() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
}

function toDateKeyKyiv(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
  }
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str.includes("T") ? str : `${str}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
}

function isConfirmedBookingStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("скас")) return false;
  if (s.includes("очікує оплату")) return false;
  if (s.includes("на підтвердженні") || s.includes("pending")) return false;
  return true;
}

function cottageSortNumber(cottage) {
  const match = String(cottage || "").match(/(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function parseChildrenFromComment(raw) {
  const match = String(raw || "").match(/👶\s*Діти[^:]*:\s*(\d+)/);
  if (!match) return 0;
  return Math.max(0, parseInt(match[1], 10) || 0);
}

function guestsLabelOrZero(booking) {
  if (!booking) return "0";
  const adults = Number(booking.guests) || 0;
  const children = parseChildrenFromComment(booking.comment || "");
  if (adults <= 0 && children <= 0) return "0";
  if (children > 0) return `${Math.max(adults, 0)}+${children}`;
  return String(adults);
}

function cleaningCottageLabel(cottage) {
  const raw = String(cottage || "").trim() || "Котедж";
  const n = cottageSortNumber(raw);
  if (Number.isFinite(n) && n !== Number.POSITIVE_INFINITY) return String(n);
  return raw;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildCleaningTurnoverCaption(t) {
  if (!t?.departure && !t?.arrival) return "";
  const label = cleaningCottageLabel(t.cottage || "Котедж");
  return `⛺️ ${escapeHtml(label)}\n\n${escapeHtml(guestsLabelOrZero(t.departure))} ➡️  ${escapeHtml(guestsLabelOrZero(t.arrival))}`;
}

function formatTelegramDaySeparator(date = new Date()) {
  const parts = new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "numeric",
    month: "long",
  }).formatToParts(date);
  const day = parts.find((p) => p.type === "day")?.value || "";
  const month = (parts.find((p) => p.type === "month")?.value || "").toUpperCase();
  return `📅 ➖➖ ${day} ${month} ➖➖ 📅`;
}

function groupCleaningTurnoversByCottage(bookings, today) {
  const map = new Map();
  for (const booking of bookings) {
    if (!isConfirmedBookingStatus(booking.status)) continue;
    const cottage = String(booking.cottage || "").trim();
    if (!cottage) continue;
    const key = cottage.toLowerCase();
    const checkIn = toDateKeyKyiv(booking.checkIn);
    const checkOut = toDateKeyKyiv(booking.checkOut);
    const isArrival = checkIn === today;
    const isDeparture = checkOut === today;
    if (!isArrival && !isDeparture) continue;
    const entry = map.get(key) ?? { cottage };
    if (isDeparture && !entry.departure) entry.departure = booking;
    if (isArrival && !entry.arrival) entry.arrival = booking;
    map.set(key, entry);
  }
  return [...map.values()].sort(
    (a, b) => cottageSortNumber(a.cottage) - cottageSortNumber(b.cottage)
  );
}

async function gasPost(body, token) {
  const gasUrl = process.env.NEXT_PUBLIC_GAS_URL?.trim();
  if (!gasUrl) throw new Error("NEXT_PUBLIC_GAS_URL is not set");
  const payload = { ...body };
  if (token && payload.accessToken === undefined) payload.accessToken = token;
  const headers = { "Content-Type": "text/plain;charset=utf-8" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(gasUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.error) {
    throw new Error(json?.message || json?.error || `GAS failed (${res.status})`);
  }
  return json;
}

async function sendTelegramMessage(botToken, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json.description || `Telegram send failed (${res.status})`);
  }
  return json;
}

async function sendDirect() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId =
    process.env.TELEGRAM_CLEANING_CHAT_ID?.trim() || "-5577418097";
  const email =
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.GAS_ADMIN_EMAIL?.trim() ||
    "Azhunebi2026";
  const password =
    process.env.ADMIN_PASSWORD?.trim() ||
    process.env.GAS_ADMIN_PASSWORD?.trim() ||
    "azhunebi12345";

  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is required");

  console.log("Logging into GAS…");
  const login = await gasPost({
    action: "login",
    email: email.trim().toLowerCase(),
    password,
  });
  const token = login.accessToken;
  if (!token) throw new Error("Login failed — no accessToken");

  console.log("Fetching bookings…");
  const bookingsRaw = await gasPost({ action: "getAllBookings" }, token);
  const bookings = Array.isArray(bookingsRaw)
    ? bookingsRaw
    : Array.isArray(bookingsRaw?.bookings)
      ? bookingsRaw.bookings
      : [];

  const today = todayKeyKyiv();
  const turnovers = groupCleaningTurnoversByCottage(bookings, today);
  console.log(`Today ${today}: ${turnovers.length} cottage(s)`);

  if (turnovers.length === 0) {
    console.log("Nothing to send.");
    return { ok: true, today, sent: 0, cottages: 0 };
  }

  await sendTelegramMessage(botToken, chatId, formatTelegramDaySeparator());
  let sent = 0;
  for (const t of turnovers) {
    const caption = buildCleaningTurnoverCaption(t);
    if (!caption) continue;
    await sendTelegramMessage(botToken, chatId, caption);
    sent += 1;
    console.log(`  sent ${t.cottage}`);
  }
  return { ok: true, today, sent, cottages: turnovers.length };
}

async function sendViaCron() {
  const useLocal = process.argv.includes("--local");
  const base =
    (process.env.BASE_URL || process.env.TELEGRAM_CRON_BASE_URL || "").replace(
      /\/$/,
      ""
    ) || (useLocal ? "http://localhost:3000" : "https://azhunebi.com");
  const secret =
    process.env.CRON_SECRET?.trim() ||
    process.env.TELEGRAM_CRON_SECRET?.trim() ||
    "";
  if (!secret) throw new Error("CRON_SECRET is required for --via-cron");
  const url = `${base}/api/internal/telegram-cron?force=cleaning`;
  console.log(`POST ${url}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  console.log(res.status, json);
  if (!res.ok || (json && json.ok === false)) {
    throw new Error(json?.error || `Cron failed (${res.status})`);
  }
  return json;
}

const viaCron = process.argv.includes("--via-cron");
try {
  const result = viaCron ? await sendViaCron() : await sendDirect();
  console.log(result);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
