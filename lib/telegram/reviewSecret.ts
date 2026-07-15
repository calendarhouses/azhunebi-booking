import { getTelegramConfig } from "./config";

export function getReviewWebhookSecret(): string {
  return getTelegramConfig().reviewWebhookSecret;
}

export function isValidReviewSecret(key: string | null | undefined): boolean {
  const expected = getReviewWebhookSecret();
  return Boolean(key && expected && key === expected);
}
