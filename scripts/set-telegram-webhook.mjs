#!/usr/bin/env node
/**
 * Ставить Telegram webhook ТІЛЬКИ для booking-бота на booking URL.
 * Заборонено: food URL / azhunebi-bot / будь-який чужий домен.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=... node scripts/set-telegram-webhook.mjs
 *   node scripts/set-telegram-webhook.mjs --url https://azhunebi-booking.vercel.app/api/webhooks/telegram
 */
import process from "node:process";

const BOOKING_WEBHOOK_PATH = "/api/webhooks/telegram";
const DEFAULT_BOOKING_ORIGIN = "https://azhunebi-booking.vercel.app";
const FORBIDDEN_HOST_PARTS = ["azhunebi-bot", "food", "menu"];

function parseArgs(argv) {
  const out = { url: null, infoOnly: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url" && argv[i + 1]) {
      out.url = argv[++i];
    } else if (argv[i] === "--info") {
      out.infoOnly = true;
    }
  }
  return out;
}

function assertBookingWebhookUrl(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error(`Invalid webhook URL: ${urlString}`);
  }
  if (url.protocol !== "https:") {
    throw new Error("Webhook URL must be https");
  }
  const host = url.hostname.toLowerCase();
  for (const part of FORBIDDEN_HOST_PARTS) {
    if (host.includes(part)) {
      throw new Error(
        `Refusing to set webhook on forbidden host "${host}" (looks like food/menu bot).`
      );
    }
  }
  if (!host.includes("azhunebi-booking") && host !== "localhost") {
    // Allow only known booking host (or explicit localhost for rare local tunnels).
    throw new Error(
      `Refusing webhook host "${host}". Expected host containing "azhunebi-booking".`
    );
  }
  if (url.pathname.replace(/\/$/, "") !== BOOKING_WEBHOOK_PATH) {
    throw new Error(
      `Webhook path must be ${BOOKING_WEBHOOK_PATH}, got ${url.pathname}`
    );
  }
  return url.toString().replace(/\/$/, "");
}

async function tg(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(`${method} failed: ${JSON.stringify(json)}`);
  }
  return json.result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }

  const me = await tg(token, "getMe");
  console.log(`Bot: @${me.username} (${me.id})`);

  if (String(me.username || "").toLowerCase().includes("food")) {
    throw new Error(
      `Refusing to configure food bot @${me.username}. Use azhunebibooking_bot token only.`
    );
  }

  const info = await tg(token, "getWebhookInfo");
  console.log("Current webhook:", info.url || "(none)");

  if (args.infoOnly) {
    return;
  }

  const target = assertBookingWebhookUrl(
    args.url || `${DEFAULT_BOOKING_ORIGIN}${BOOKING_WEBHOOK_PATH}`
  );

  await tg(token, "setWebhook", {
    url: target,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });

  const after = await tg(token, "getWebhookInfo");
  console.log("Webhook set to:", after.url);
  console.log("allowed_updates:", after.allowed_updates || "(default)");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
