import type { AdminInitResponse } from "@/components/admin/desktop/types";
import { createBooking, fetchInitData } from "@/lib/gas-api";

export async function fetchPublicInitData(
  tenantId: string
): Promise<AdminInitResponse> {
  return fetchInitData(tenantId);
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

export async function createMonoPayment(orderId: string): Promise<{
  pageUrl: string;
  amount: number;
}> {
  const response = await fetch("/api/payments/monopay/invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });
  const data = (await response.json()) as {
    ok?: boolean;
    pageUrl?: string;
    amount?: number;
    message?: string;
  };
  if (!response.ok || !data.ok || !data.pageUrl) {
    throw new Error(data.message || "Не вдалося створити рахунок MonoPay");
  }
  return { pageUrl: data.pageUrl, amount: Number(data.amount) || 0 };
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
