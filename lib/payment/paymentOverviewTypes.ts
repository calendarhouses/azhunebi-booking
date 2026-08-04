/** Client-safe types for the Оплата overview UI (no server-only deps). */

export type PaymentFeedItem = {
  id: string;
  at: string;
  outcome: "success" | "failure" | "expired";
  bookingId: string;
  guestName?: string;
  amount?: number;
  provider?: string;
  transactionId?: string;
  reason?: string;
  channel?: string;
};

export type PaymentAwaitingItem = {
  bookingId: string;
  name: string;
  cottage: string;
  checkIn: string;
  checkOut: string;
  prepayAmount: number;
  paymentExpiresAt: string | null;
  expiresInMs: number | null;
  payUrl: string;
};

export type PaymentHealthSnapshot = {
  onlineEnabled: boolean;
  forceOff: boolean;
  paymentWindowHours: number;
  awaitingCount: number;
  token: {
    configured: boolean;
    valid: boolean | null;
    last4: string | null;
    fromEnv: boolean;
    merchantName: string | null;
  };
  webhook: {
    lastAt: string | null;
    lastOk: boolean | null;
    lastStatus: string | null;
    lastChannel: "monopay" | "monoparts" | null;
    acquiringUrl: string;
    partsUrl: string;
  };
};
