export type MonoInvoiceCreateResponse = {
  invoiceId: string;
  pageUrl: string;
  appUrl?: string;
};

export type MonoInvoiceStatusResponse = MonoWebhookPayload & {
  invoiceId: string;
  status: string;
};

export type MonoWebhookPayload = {
  invoiceId?: string;
  status?: string;
  failureReason?: string;
  amount?: number;
  finalAmount?: number;
  ccy?: number;
  reference?: string;
  createdDate?: string;
  modifiedDate?: string;
};

export type MonoInvoiceResult =
  | {
      ok: true;
      invoiceId: string;
      pageUrl: string;
      amount: number;
      reference: string;
    }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
    };
