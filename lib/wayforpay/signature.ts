import { createHmac, timingSafeEqual } from "crypto";
import type { WayForPayAcceptResponse, WayForPayCallbackPayload } from "./types";
import { getWayForPaySecretKey } from "./config";

function field(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

/** HMAC-MD5 hex (WayForPay standard). */
export function computeWayForPayHmacMd5Hex(message: string, secretKey: string): string {
  return createHmac("md5", secretKey).update(message, "utf8").digest("hex");
}

/** Purchase request signature (redirect to pay page). */
export function buildPurchaseSignatureString(params: {
  merchantAccount: string;
  merchantDomainName: string;
  orderReference: string;
  orderDate: number;
  amount: number;
  currency: string;
  productName: string;
  productCount: string;
  productPrice: string;
}): string {
  const amountStr = String(params.amount);
  return [
    params.merchantAccount,
    params.merchantDomainName,
    params.orderReference,
    params.orderDate,
    amountStr,
    params.currency,
    params.productName,
    params.productCount,
    amountStr,
  ].join(";");
}

/** serviceUrl callback verification string. */
export function buildCallbackSignatureString(payload: WayForPayCallbackPayload): string {
  return [
    field(payload.merchantAccount),
    field(payload.orderReference),
    field(payload.amount),
    field(payload.currency),
    field(payload.authCode),
    field(payload.cardPan),
    field(payload.transactionStatus),
    field(payload.reasonCode),
  ].join(";");
}

/** Response to serviceUrl: orderReference;accept;time (seconds). */
export function buildAcceptResponseSignatureString(
  orderReference: string,
  timeSeconds: number
): string {
  return `${orderReference};accept;${timeSeconds}`;
}

export function verifyCallbackSignature(
  payload: WayForPayCallbackPayload,
  secretKey: string
): boolean {
  const received = field(payload.merchantSignature).toLowerCase();
  if (!received) return false;

  const expected = computeWayForPayHmacMd5Hex(
    buildCallbackSignatureString(payload),
    secretKey
  ).toLowerCase();

  if (received.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(received, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

export function buildWebhookAcceptResponse(
  orderReference: string,
  secretKey: string
): WayForPayAcceptResponse {
  const time = Math.floor(Date.now() / 1000);
  const signature = computeWayForPayHmacMd5Hex(
    buildAcceptResponseSignatureString(orderReference, time),
    secretKey
  );

  return {
    orderReference,
    status: "accept",
    time,
    signature,
  };
}

export function requireWayForPaySecretKey(): string {
  const key = getWayForPaySecretKey();
  if (!key) {
    throw new Error("WAYFORPAY_SECRET_KEY is not configured");
  }
  return key;
}
