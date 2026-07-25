import "server-only";

import {
  getMonoChastApiOrigin,
  MONO_CHAST_PARTS_COUNT,
  requireMonoChastStoreId,
} from "./config";
import { signMonoChastBody } from "./signature";
import type {
  MonoChastCreateOrderResponse,
  MonoChastOrderStateResponse,
} from "./types";

export class MonoChastApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string
  ) {
    super(message);
    this.name = "MonoChastApiError";
  }
}

async function chastFetch<T>(path: string, payload: unknown): Promise<T> {
  const body = JSON.stringify(payload);
  const response = await fetch(`${getMonoChastApiOrigin()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Accept: "application/json",
      "store-id": requireMonoChastStoreId(),
      signature: signMonoChastBody(body),
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  const text = await response.text();
  let parsed: T | { message?: string } | null = null;
  try {
    parsed = text ? (JSON.parse(text) as T | { message?: string }) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const message =
      (parsed && typeof parsed === "object" && "message" in parsed && parsed.message) ||
      `Mono Chast request failed (${response.status})`;
    throw new MonoChastApiError(String(message), response.status, text);
  }

  if (!parsed) {
    throw new MonoChastApiError("Mono Chast returned an empty response", 502, text);
  }
  return parsed as T;
}

export async function createMonoChastOrder(params: {
  storeOrderId: string;
  clientPhone: string;
  totalSumUah: number;
  invoiceNumber: string;
  productName: string;
  resultCallback: string;
}): Promise<{ orderId: string }> {
  const totalSum = Math.round(params.totalSumUah * 100) / 100;
  if (!(totalSum >= 2)) {
    throw new Error("Invalid Mono Chast amount");
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
  const data = await chastFetch<MonoChastCreateOrderResponse>("/api/order/create", {
    store_order_id: params.storeOrderId.slice(0, 64),
    client_phone: params.clientPhone,
    total_sum: totalSum,
    invoice: {
      date: today,
      number: params.invoiceNumber.slice(0, 64),
      source: "INTERNET",
    },
    available_programs: [
      {
        type: "payment_installments",
        available_parts_count: [...MONO_CHAST_PARTS_COUNT],
      },
    ],
    products: [
      {
        name: params.productName.slice(0, 250),
        count: 1,
        sum: totalSum,
      },
    ],
    result_callback: params.resultCallback,
  });

  const orderId = String(data.order_id || data.orderId || "").trim();
  if (!orderId) {
    throw new MonoChastApiError("Mono Chast returned no order_id", 502);
  }
  return { orderId };
}

export async function getMonoChastOrderState(
  orderId: string
): Promise<MonoChastOrderStateResponse> {
  return chastFetch<MonoChastOrderStateResponse>("/api/order/state", {
    order_id: orderId,
  });
}

export async function confirmMonoChastOrder(orderId: string): Promise<void> {
  await chastFetch("/api/order/confirm", { order_id: orderId });
}

/**
 * Повернення коштів за заявкою «Покупка частинами» (повне або часткове).
 * sumUah — сума повернення у гривнях (як total_sum при створенні).
 * return_money_to_card=true → банк повертає гроші на картку клієнта.
 * POST /api/order/return
 */
export async function returnMonoChastOrder(params: {
  orderId: string;
  sumUah: number;
  storeReturnId: string;
}): Promise<void> {
  const sum = Math.round(params.sumUah * 100) / 100;
  if (!(sum > 0)) {
    throw new MonoChastApiError("Invalid Mono Chast return amount", 400);
  }
  await chastFetch("/api/order/return", {
    order_id: params.orderId,
    return_money_to_card: true,
    store_return_id: params.storeReturnId.slice(0, 64),
    sum,
  });
}
