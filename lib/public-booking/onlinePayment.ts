/**
 * Temporary kill-switch for public online payment (Mono).
 * Account blocked → keep OFF so guests never land on /pay.
 *
 * Re-enable later: set NEXT_PUBLIC_ONLINE_PAYMENT_ENABLED=true in Vercel.
 * (Also works with "1" / "yes".)
 */
export function isPublicOnlinePaymentEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_ONLINE_PAYMENT_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
