import "server-only";

import { createVerify } from "node:crypto";
import { getMonoPublicKeyBase64 } from "./client";

function verifyWithKey(rawBody: Buffer, signatureBase64: string, publicKeyBase64: string): boolean {
  try {
    const verifier = createVerify("SHA256");
    verifier.update(rawBody);
    verifier.end();
    return verifier.verify(
      Buffer.from(publicKeyBase64, "base64"),
      Buffer.from(signatureBase64, "base64")
    );
  } catch {
    return false;
  }
}

export async function verifyMonoWebhookSignature(
  rawBody: Buffer,
  signatureBase64: string
): Promise<boolean> {
  if (!signatureBase64.trim() || rawBody.length === 0) return false;

  const cachedKey = await getMonoPublicKeyBase64();
  if (verifyWithKey(rawBody, signatureBase64, cachedKey)) return true;

  // Mono allows caching the key; refresh once if they rotated it.
  const freshKey = await getMonoPublicKeyBase64(true);
  return verifyWithKey(rawBody, signatureBase64, freshKey);
}
