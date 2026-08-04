import "server-only";

import { getMonoApiOrigin, requireMonoAcquiringToken } from "./config";
import type { MonoInvoiceCreateResponse, MonoInvoiceStatusResponse } from "./types";

type MonoErrorBody = {
  errCode?: string;
  errText?: string;
  errorDescription?: string;
};

export class MonoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "MonoApiError";
  }
}

async function readMonoResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: T | MonoErrorBody | null = null;
  try {
    payload = text ? (JSON.parse(text) as T | MonoErrorBody) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = (payload || {}) as MonoErrorBody;
    throw new MonoApiError(
      error.errText ||
        error.errorDescription ||
        `Mono acquiring request failed (${response.status})`,
      response.status,
      error.errCode
    );
  }

  if (!payload) {
    throw new MonoApiError("Mono acquiring returned an empty response", 502);
  }
  return payload as T;
}

export async function createMonoInvoice(params: {
  reference: string;
  amountUah: number;
  destination: string;
  redirectUrl: string;
  webHookUrl: string;
  validitySeconds: number;
}): Promise<MonoInvoiceCreateResponse> {
  const amount = Math.round(params.amountUah * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Invalid Mono invoice amount");
  }

  const token = await requireMonoAcquiringToken();
  const response = await fetch(`${getMonoApiOrigin()}/api/merchant/invoice/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Token": token,
    },
    body: JSON.stringify({
      amount,
      ccy: 980,
      merchantPaymInfo: {
        reference: params.reference,
        destination: params.destination.slice(0, 280),
      },
      redirectUrl: params.redirectUrl,
      webHookUrl: params.webHookUrl,
      validity: Math.max(60, Math.min(24 * 60 * 60, Math.floor(params.validitySeconds))),
      paymentType: "debit",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const data = await readMonoResponse<MonoInvoiceCreateResponse>(response);
  if (!data.invoiceId || !data.pageUrl) {
    throw new MonoApiError("Mono acquiring returned an invalid invoice", 502);
  }
  return data;
}

export type MonoInvoiceCancelResponse = {
  status: string;
  createdDate?: string;
  modifiedDate?: string;
};

/**
 * Скасування (повне або часткове повернення) успішної оплати рахунку.
 * amountUah не передається → повне повернення; інакше — часткове.
 * POST /api/merchant/invoice/cancel
 */
export async function cancelMonoInvoice(params: {
  invoiceId: string;
  amountUah?: number;
  extRef?: string;
}): Promise<MonoInvoiceCancelResponse> {
  const body: Record<string, unknown> = { invoiceId: params.invoiceId };
  if (params.extRef) body.extRef = params.extRef.slice(0, 64);
  if (params.amountUah != null) {
    const amount = Math.round(params.amountUah * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new MonoApiError("Invalid Mono refund amount", 400);
    }
    body.amount = amount;
  }

  const token = await requireMonoAcquiringToken();
  const response = await fetch(`${getMonoApiOrigin()}/api/merchant/invoice/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Token": token,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  return readMonoResponse<MonoInvoiceCancelResponse>(response);
}

export async function getMonoInvoiceStatus(
  invoiceId: string
): Promise<MonoInvoiceStatusResponse> {
  const url = new URL(`${getMonoApiOrigin()}/api/merchant/invoice/status`);
  url.searchParams.set("invoiceId", invoiceId);
  const token = await requireMonoAcquiringToken();
  const response = await fetch(url, {
    headers: { "X-Token": token },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  return readMonoResponse<MonoInvoiceStatusResponse>(response);
}

let cachedPublicKeyBase64: string | null = null;

function extractPublicKey(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new MonoApiError("Mono public key response is empty", 502);

  try {
    const parsed = JSON.parse(trimmed) as string | { key?: string; pubkey?: string };
    if (typeof parsed === "string") return parsed.trim();
    const key = parsed.key || parsed.pubkey;
    if (key) return key.trim();
  } catch {
    // Mono may return a plain Base64 string.
  }
  return trimmed.replace(/^"|"$/g, "");
}

export async function getMonoPublicKeyBase64(forceRefresh = false): Promise<string> {
  if (cachedPublicKeyBase64 && !forceRefresh) return cachedPublicKeyBase64;

  const token = await requireMonoAcquiringToken();
  const response = await fetch(`${getMonoApiOrigin()}/api/merchant/pubkey`, {
    headers: { "X-Token": token },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new MonoApiError(
      `Unable to fetch Mono webhook public key (${response.status})`,
      response.status
    );
  }

  cachedPublicKeyBase64 = extractPublicKey(await response.text());
  return cachedPublicKeyBase64;
}

export type MonoMerchantDetails = {
  merchantId?: string;
  merchantName?: string;
  edrpou?: string;
};

/** Lightweight token check — GET /api/merchant/details */
export async function getMonoMerchantDetails(
  tokenOverride?: string
): Promise<MonoMerchantDetails> {
  const token = tokenOverride?.trim() || (await requireMonoAcquiringToken());
  const response = await fetch(`${getMonoApiOrigin()}/api/merchant/details`, {
    headers: { "X-Token": token },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  return readMonoResponse<MonoMerchantDetails>(response);
}
