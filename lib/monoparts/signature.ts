import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { requireMonoChastSignKey } from "./config";

/** Base64(HMAC-SHA256(request_body_utf8, store_secret)) */
export function signMonoChastBody(body: string, secret = requireMonoChastSignKey()): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

export function verifyMonoChastSignature(
  body: string,
  signatureHeader: string,
  secret = requireMonoChastSignKey()
): boolean {
  const expected = signMonoChastBody(body, secret);
  const provided = String(signatureHeader || "").trim();
  if (!provided) return false;
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
