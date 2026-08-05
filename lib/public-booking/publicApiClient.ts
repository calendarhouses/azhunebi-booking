import type { AdminInitResponse } from "@/components/admin/desktop/types";
import { createBooking } from "@/lib/gas-api";

export type FetchPublicInitOptions = {
  /** Bypass CDN + Data Cache after overbooking / mutation. */
  fresh?: boolean;
};

/**
 * Public catalog init — dedicated cached route (5 min), not /api/gas.
 * Use `{ fresh: true }` when availability must be current (e.g. OVERLAP).
 */
export async function fetchPublicInitData(
  tenantId: string,
  options?: FetchPublicInitOptions
): Promise<AdminInitResponse> {
  const qs = new URLSearchParams({
    tenant_id: tenantId || "default",
  });
  if (options?.fresh) qs.set("fresh", "1");

  const res = await fetch(`/api/public/init?${qs.toString()}`, {
    cache: options?.fresh ? "no-store" : "default",
  });
  const data = (await res.json()) as AdminInitResponse & {
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(data.message || data.error || `HTTP ${res.status}`);
  }
  return data;
}

export type SubmitBookingPayload = Record<string, unknown> & {
  tenant_id: string;
  checkIn: string;
  checkOut: string;
  cottage: string;
  name: string;
  phone: string;
  guests: number;
  pets: string;
  source: "Сайт";
  status: string;
  totalPrice: number;
  paidAmount: number;
  comment?: string;
  basePrice?: number;
  extraGuestFee?: number;
  petFee?: number;
  dayGuestFee?: number;
  earlyFee?: number;
  lateFee?: number;
};

export type SubmitBookingResult = {
  success?: boolean;
  error?: string;
  requiredMin?: number;
  nights?: number;
  orderId?: string;
  prepayment?: number;
  flow?: "instant" | "pending_review";
};

export async function submitPublicBooking(
  payload: SubmitBookingPayload
): Promise<SubmitBookingResult> {
  return createBooking(payload) as Promise<SubmitBookingResult>;
}

export async function createMonoPayment(
  orderId: string,
  amountKind: "prepay" | "full" = "prepay"
): Promise<{
  pageUrl: string;
  amount: number;
  amountKind: "prepay" | "full";
}> {
  const response = await fetch("/api/payments/monopay/invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, amountKind }),
  });
  const data = (await response.json()) as {
    ok?: boolean;
    pageUrl?: string;
    amount?: number;
    amountKind?: "prepay" | "full";
    message?: string;
  };
  if (!response.ok || !data.ok || !data.pageUrl) {
    throw new Error(data.message || "Не вдалося створити рахунок MonoPay");
  }
  return {
    pageUrl: data.pageUrl,
    amount: Number(data.amount) || 0,
    amountKind: data.amountKind === "full" ? "full" : "prepay",
  };
}

export async function createMonoPartsOrder(
  orderId: string,
  amountKind: "prepay" | "full" = "prepay"
): Promise<{
  orderId: string;
  amount: number;
  amountKind: "prepay" | "full";
  partsCount: number[];
}> {
  const response = await fetch("/api/payments/monoparts/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, amountKind }),
  });
  const data = (await response.json()) as {
    ok?: boolean;
    orderId?: string;
    amount?: number;
    amountKind?: "prepay" | "full";
    partsCount?: number[];
    message?: string;
  };
  if (!response.ok || !data.ok || !data.orderId) {
    throw new Error(data.message || "Не вдалося створити заявку Покупки частинами");
  }
  return {
    orderId: data.orderId,
    amount: Number(data.amount) || 0,
    amountKind: data.amountKind === "full" ? "full" : "prepay",
    partsCount: Array.isArray(data.partsCount) ? data.partsCount : [3],
  };
}

export async function pollMonoPartsStatus(orderId: string): Promise<{
  paid: boolean;
  awaiting: boolean;
  waitingClient?: boolean;
  failed?: boolean;
  message?: string;
}> {
  const response = await fetch(
    `/api/payments/monoparts/status?orderId=${encodeURIComponent(orderId)}`,
    { cache: "no-store" }
  );
  const data = (await response.json()) as {
    ok?: boolean;
    paid?: boolean;
    awaiting?: boolean;
    waitingClient?: boolean;
    failed?: boolean;
    message?: string;
    error?: string;
  };
  if (!response.ok || !data.ok) {
    throw new Error(data.message || data.error || "Не вдалося перевірити статус ПЧ");
  }
  return {
    paid: Boolean(data.paid),
    awaiting: Boolean(data.awaiting),
    waitingClient: data.waitingClient,
    failed: data.failed,
    message: data.message,
  };
}

export async function abandonMonoPartsOrder(orderId: string): Promise<void> {
  const response = await fetch("/api/payments/monoparts/abandon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });
  const data = (await response.json()) as { ok?: boolean; message?: string };
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Не вдалося скинути заявку ПЧ");
  }
}

export async function ensurePaymentLinkSms(orderId: string): Promise<boolean> {
  const response = await fetch("/api/bookings/payment-link-sms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
    keepalive: true,
  });
  return response.ok;
}
