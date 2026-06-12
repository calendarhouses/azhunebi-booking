import type { AdminInitResponse } from "@/components/admin/desktop/types";
import { createBooking, fetchInitData } from "@/lib/gas-api";
import type { PaymentData } from "./types";

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
  paymentData?: PaymentData;
};

export async function submitPublicBooking(
  payload: SubmitBookingPayload
): Promise<SubmitBookingResult> {
  return createBooking(payload) as Promise<SubmitBookingResult>;
}

export function redirectToWayForPay(
  paymentData: PaymentData,
  client: { firstName: string; lastName: string; phone: string },
  returnUrl: string
) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "https://secure.wayforpay.com/pay";
  form.style.display = "none";

  const params: Record<string, string | number> = {
    merchantAccount: paymentData.merchantAccount,
    merchantDomainName: paymentData.merchantDomainName,
    merchantSignature: paymentData.signature,
    orderReference: paymentData.orderReference,
    orderDate: paymentData.orderDate,
    amount: paymentData.amount,
    currency: paymentData.currency,
    productName: paymentData.productName,
    productCount: 1,
    clientFirstName: client.firstName,
    clientLastName: client.lastName,
    clientPhone: client.phone,
    language: "UA",
    returnUrl,
  };

  for (const [key, value] of Object.entries(params)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = String(value);
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
