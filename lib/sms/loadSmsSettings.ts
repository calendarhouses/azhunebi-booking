import "server-only";

import { gasFetch, gasPost } from "@/lib/gas-api";
import { normalizeSmsSettings, type SmsSettings } from "./smsSettings";

function systemWebhookSecret(): string {
  return (
    process.env.TELEGRAM_REVIEW_WEBHOOK_SECRET?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    ""
  );
}

/** Load SMS settings with an admin Bearer token (settings action). */
export async function loadSmsSettings(options?: {
  authToken?: string | null;
  tenantId?: string | null;
}): Promise<SmsSettings> {
  if (options?.authToken) {
    try {
      const data = await gasFetch<{ smsSettings?: unknown }>(
        { action: "settings", tenant_id: options.tenantId || undefined },
        { authToken: options.authToken },
      );
      return normalizeSmsSettings(data.smsSettings);
    } catch (err) {
      console.warn("[SMS] Failed to load settings via auth, falling back", err);
    }
  }
  return loadSmsSettingsSystem();
}

/** Load SMS settings via webhook-secret GAS action (cron / webhooks). */
export async function loadSmsSettingsSystem(): Promise<SmsSettings> {
  const secret = systemWebhookSecret();
  if (!secret) return normalizeSmsSettings(undefined);

  try {
    const data = await gasPost<{ smsSettings?: unknown; error?: string }>({
      action: "getSmsSettings",
      webhookSecret: secret,
    });
    if (data.error) {
      console.warn("[SMS] getSmsSettings error:", data.error);
      return normalizeSmsSettings(undefined);
    }
    return normalizeSmsSettings(data.smsSettings);
  } catch (err) {
    console.warn("[SMS] Failed to load settings via system secret", err);
    return normalizeSmsSettings(undefined);
  }
}
