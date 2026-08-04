/**
 * Public online payment gate.
 *
 * Server: prefer `isOnlinePaymentEnabledServer()` (reads Supabase paymentSettings).
 * Client: use `isOnlinePaymentEnabledFromSettings(initSettings)`.
 *
 * Legacy sync helper kept for gradual migration — falls back to env only.
 */

import {
  isOnlinePaymentEnabledFromSettings,
  isOnlinePaymentForceOff,
  legacyEnvOnlinePaymentEnabled,
} from "@/lib/payment/paymentSettings";

export {
  isOnlinePaymentEnabledFromSettings,
  isOnlinePaymentForceOff,
  legacyEnvOnlinePaymentEnabled,
};

/**
 * @deprecated Prefer async server helper or settings-based client check.
 * Sync env-only — used only where settings are unavailable.
 */
export function isPublicOnlinePaymentEnabled(): boolean {
  if (isOnlinePaymentForceOff()) return false;
  return legacyEnvOnlinePaymentEnabled();
}
