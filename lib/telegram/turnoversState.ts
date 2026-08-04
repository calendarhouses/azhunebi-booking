import "server-only";

import { loadAllSettings, saveSettingsKey } from "@/lib/db/settings";
import { toDateKeyKyiv } from "./formatters";

export type TelegramMessageRef = {
  chatId: string | number;
  messageId: number;
};

export type TelegramTurnoversStateDay = {
  arrivals?: Record<string, TelegramMessageRef>;
  departures?: Record<string, TelegramMessageRef>;
  cleaning?: Record<string, TelegramMessageRef>;
};

export type TelegramTurnoversState = Record<string, TelegramTurnoversStateDay>;

/** null = remove this key from stored state (after deleting Telegram message). */
export type TelegramTurnoversStatePatch = {
  arrivals?: Record<string, TelegramMessageRef | null>;
  departures?: Record<string, TelegramMessageRef | null>;
  cleaning?: Record<string, TelegramMessageRef | null>;
};

function parseState(raw: unknown): TelegramTurnoversState {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as TelegramTurnoversState;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as TelegramTurnoversState;
      }
    } catch {
      /* ignore */
    }
  }
  return {};
}

function applyBucket(
  current: Record<string, TelegramMessageRef> | undefined,
  patch: Record<string, TelegramMessageRef | null> | undefined
): Record<string, TelegramMessageRef> {
  const next = { ...(current || {}) };
  if (!patch) return next;
  for (const [key, value] of Object.entries(patch)) {
    if (value == null) delete next[key];
    else next[key] = value;
  }
  return next;
}

/** Merge patch into settings.telegramTurnoversState for one Kyiv day. */
export async function upsertTelegramTurnoversState(
  day: string | Date,
  patch: TelegramTurnoversStatePatch
): Promise<TelegramTurnoversState> {
  const dayKey = toDateKeyKyiv(day);
  if (!dayKey) return {};

  const settings = await loadAllSettings();
  const state = parseState(settings.telegramTurnoversState);
  const dayState = { ...(state[dayKey] || {}) };

  if (patch.arrivals) {
    dayState.arrivals = applyBucket(dayState.arrivals, patch.arrivals);
  }
  if (patch.departures) {
    dayState.departures = applyBucket(dayState.departures, patch.departures);
  }
  if (patch.cleaning) {
    dayState.cleaning = applyBucket(dayState.cleaning, patch.cleaning);
  }

  const next: TelegramTurnoversState = { ...state, [dayKey]: dayState };
  await saveSettingsKey("telegramTurnoversState", next);
  return next;
}

export function readTelegramTurnoversState(
  settings: Record<string, unknown> | null | undefined
): TelegramTurnoversState {
  return parseState(settings?.telegramTurnoversState);
}
