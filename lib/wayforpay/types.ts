/** Callback body from WayForPay serviceUrl (Purchase). */
export type WayForPayCallbackPayload = {
  merchantAccount?: string;
  orderReference?: string;
  merchantSignature?: string;
  amount?: number | string;
  currency?: string;
  authCode?: string;
  cardPan?: string;
  transactionStatus?: string;
  reasonCode?: string | number;
  reason?: string;
  email?: string;
  phone?: string;
  createdDate?: number;
  processingDate?: number;
  cardType?: string;
  issuerBankCountry?: string;
  issuerBankName?: string;
  recToken?: string;
  fee?: number | string;
  paymentSystem?: string;
  repayUrl?: string;
};

export type WayForPayAcceptResponse = {
  orderReference: string;
  status: "accept";
  time: number;
  signature: string;
};
