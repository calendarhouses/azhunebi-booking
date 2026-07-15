import {
  buildPurchaseSignatureString,
  computeWayForPayHmacMd5Hex,
} from "./signature";
import {
  getWayForPayMerchantAccount,
  getWayForPayMerchantDomain,
  getWayForPaySecretKey,
} from "./config";
import type { PaymentData } from "@/lib/public-booking/types";

export function createWayForPayPaymentData(params: {
  orderReference: string;
  amount: number;
  productName: string;
  orderDate?: number;
}): PaymentData | null {
  const secretKey = getWayForPaySecretKey();
  if (!secretKey) return null;

  const amount = Math.round(Number(params.amount) || 0);
  if (amount <= 0) return null;

  const merchantAccount = getWayForPayMerchantAccount();
  const merchantDomainName = getWayForPayMerchantDomain();
  const orderDate = params.orderDate ?? Math.round(Date.now() / 1000);
  const productName = params.productName;
  const productCount = 1;
  const currency = "UAH";
  const amountStr = String(amount);

  const signature = computeWayForPayHmacMd5Hex(
    buildPurchaseSignatureString({
      merchantAccount,
      merchantDomainName,
      orderReference: params.orderReference,
      orderDate,
      amount,
      currency,
      productName,
      productCount: String(productCount),
      productPrice: amountStr,
    }),
    secretKey
  );

  return {
    merchantAccount,
    merchantDomainName,
    orderReference: params.orderReference,
    orderDate,
    amount,
    currency,
    productName,
    signature,
  };
}
