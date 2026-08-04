/**
 * External cron auth (cron-job.org etc.).
 * Only `Authorization: Bearer <secret>` — no Vercel-specific headers.
 */
export function authorizeBearer(
  request: Request,
  secrets: Array<string | undefined | null>
): boolean {
  const authorization = request.headers.get("authorization") || "";
  const valid = secrets
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  if (!valid.length) return false;
  return valid.some((secret) => authorization === `Bearer ${secret}`);
}

/** Shared secrets for Telegram digests, iCal sync, keepalive. */
export function cronSecrets(): Array<string | undefined> {
  return [process.env.CRON_SECRET, process.env.TELEGRAM_CRON_SECRET];
}

/** Payment lifecycle accepts dedicated secret or shared cron secrets. */
export function paymentLifecycleSecrets(): Array<string | undefined> {
  return [
    process.env.PAYMENT_LIFECYCLE_SECRET,
    process.env.CRON_SECRET,
    process.env.TELEGRAM_CRON_SECRET,
  ];
}

/** Migrate / reconcile / checksum. */
export function migrateSecrets(): Array<string | undefined> {
  return [
    process.env.MIGRATE_SECRET,
    process.env.CRON_SECRET,
    process.env.TELEGRAM_CRON_SECRET,
  ];
}
