import "server-only";

import { loadAllSettings } from "@/lib/db/settings";
import {
  hasPaymentSettingsRecord,
  resolveMonoAcquiringTokenFromSettings,
  resolveOnlinePaymentEnabled,
  toPublicPaymentSettings,
  type PaymentSettingsPublic,
} from "./paymentSettings";

export async function loadPaymentSettingsRaw(): Promise<{
  raw: unknown;
  hasRecord: boolean;
}> {
  const settings = await loadAllSettings();
  const raw = settings.paymentSettings;
  return { raw, hasRecord: hasPaymentSettingsRecord(raw) };
}

export async function loadPublicPaymentSettings(): Promise<PaymentSettingsPublic> {
  const { raw, hasRecord } = await loadPaymentSettingsRaw();
  return toPublicPaymentSettings(raw, { hasRecord });
}

export async function isOnlinePaymentEnabledServer(): Promise<boolean> {
  const { raw, hasRecord } = await loadPaymentSettingsRaw();
  return resolveOnlinePaymentEnabled(raw, { hasRecord });
}

export async function resolveMonoAcquiringTokenServer(): Promise<string> {
  const { raw } = await loadPaymentSettingsRaw();
  return resolveMonoAcquiringTokenFromSettings(raw);
}
