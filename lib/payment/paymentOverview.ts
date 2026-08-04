import "server-only";

import { listBookings } from "@/lib/db/bookings";
import { loadAllSettings } from "@/lib/db/settings";
import { getPublicOrigin } from "@/lib/monopay/config";
import { getMonoMerchantDetails, MonoApiError } from "@/lib/monopay/client";
import { buildGuestPaymentUrl } from "@/lib/admin/guestMessengerLinks";
import { isAwaitingPaymentStatus } from "@/lib/public-booking/bookingReview";
import {
  hasPaymentSettingsRecord,
  normalizePaymentSettings,
  resolveOnlinePaymentEnabled,
  toPublicPaymentSettings,
  type PaymentJournalEntry,
  type PaymentWebhookHealth,
} from "./paymentSettings";
import { resolveMonoAcquiringTokenServer } from "./loadPaymentSettings";

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
  webhook: PaymentWebhookHealth & {
    acquiringUrl: string;
    partsUrl: string;
  };
};

function isMonoProvider(provider: unknown): boolean {
  return /mono/i.test(String(provider || ""));
}

function pushUnique(
  map: Map<string, PaymentFeedItem>,
  item: PaymentFeedItem
) {
  const key =
    item.transactionId
      ? `tx:${item.transactionId}`
      : `${item.outcome}:${item.bookingId}:${item.at}`;
  if (!map.has(key)) map.set(key, item);
}

export async function buildPaymentOverview(opts?: {
  probeToken?: boolean;
}): Promise<{
  health: PaymentHealthSnapshot;
  feed: PaymentFeedItem[];
  awaiting: PaymentAwaitingItem[];
}> {
  const [settings, bookings] = await Promise.all([
    loadAllSettings(),
    listBookings(),
  ]);
  const raw = settings.paymentSettings;
  const hasRecord = hasPaymentSettingsRecord(raw);
  const stored = normalizePaymentSettings(raw);
  const pub = toPublicPaymentSettings(raw, { hasRecord });
  const publicOrigin = getPublicOrigin();

  const feedMap = new Map<string, PaymentFeedItem>();

  for (const entry of stored.journal || []) {
    pushUnique(feedMap, {
      id: entry.id,
      at: entry.at,
      outcome: entry.outcome,
      bookingId: entry.bookingId,
      guestName: entry.guestName,
      amount: entry.amount,
      provider: entry.provider,
      transactionId: entry.transactionId,
      reason: entry.reason,
      channel: entry.channel,
    });
  }

  for (const booking of bookings) {
    const bookingId = String(booking.id || "").trim();
    if (!bookingId) continue;
    const payments = Array.isArray(booking.payments) ? booking.payments : [];
    for (const pay of payments) {
      if (!pay || typeof pay !== "object") continue;
      const p = pay as Record<string, unknown>;
      const provider = String(p.provider || p.method || "");
      if (!isMonoProvider(provider)) continue;
      const at = String(p.at || p.date || "").trim();
      if (!at) continue;
      pushUnique(feedMap, {
        id: `pay_${bookingId}_${String(p.transactionId || at)}`,
        at,
        outcome: "success",
        bookingId,
        guestName: String(booking.name || "").trim() || undefined,
        amount: Math.round(Number(p.amount) || 0) || undefined,
        provider: provider || "Mono",
        transactionId: String(p.transactionId || "").trim() || undefined,
        channel: /пч|parts|chast/i.test(provider) ? "monoparts" : "monopay",
      });
    }

    const expiredAt = String(booking.expiredAt || "").trim();
    if (
      expiredAt &&
      /скасов/i.test(String(booking.status || "")) &&
      String(booking.source || "") === "Сайт"
    ) {
      pushUnique(feedMap, {
        id: `exp_${bookingId}_${expiredAt}`,
        at: expiredAt,
        outcome: "expired",
        bookingId,
        guestName: String(booking.name || "").trim() || undefined,
        amount: Math.round(Number(booking.prepayAmount) || 0) || undefined,
        reason: "Час на оплату вичерпано",
        channel: "lifecycle",
      });
    }
  }

  const feed = [...feedMap.values()]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 10);

  const now = Date.now();
  const awaiting: PaymentAwaitingItem[] = bookings
    .filter((b) => isAwaitingPaymentStatus(String(b.status || "")))
    .map((b) => {
      const bookingId = String(b.id || "").trim();
      const expiresRaw = String(b.paymentExpiresAt || "").trim();
      const expiresAt = expiresRaw ? Date.parse(expiresRaw) : NaN;
      return {
        bookingId,
        name: String(b.name || "Гість").trim() || "Гість",
        cottage: String(b.cottage || "").trim(),
        checkIn: String(b.checkIn || ""),
        checkOut: String(b.checkOut || ""),
        prepayAmount: Math.round(Number(b.prepayAmount) || 0),
        paymentExpiresAt: expiresRaw || null,
        expiresInMs: Number.isFinite(expiresAt) ? expiresAt - now : null,
        payUrl: buildGuestPaymentUrl(bookingId, publicOrigin),
      };
    })
    .filter((b) => b.bookingId)
    .sort((a, b) => {
      const ae = a.expiresInMs ?? Number.POSITIVE_INFINITY;
      const be = b.expiresInMs ?? Number.POSITIVE_INFINITY;
      return ae - be;
    });

  let tokenValid: boolean | null = null;
  let merchantName: string | null = null;
  if (opts?.probeToken !== false && pub.tokenConfigured) {
    try {
      const token = await resolveMonoAcquiringTokenServer();
      if (token) {
        const details = await getMonoMerchantDetails(token);
        tokenValid = true;
        merchantName = String(details.merchantName || details.merchantId || "").trim() || null;
      } else {
        tokenValid = false;
      }
    } catch (err) {
      tokenValid = false;
      if (!(err instanceof MonoApiError)) {
        console.warn("[paymentOverview] token probe failed", err);
      }
    }
  }

  const webhook: PaymentHealthSnapshot["webhook"] = {
    ...(stored.webhook || {
      lastAt: null,
      lastOk: null,
      lastStatus: null,
      lastChannel: null,
    }),
    acquiringUrl: `${publicOrigin}/api/webhooks/monopay`,
    partsUrl: `${publicOrigin}/api/webhooks/monoparts`,
  };

  return {
    health: {
      onlineEnabled: resolveOnlinePaymentEnabled(raw, { hasRecord }),
      forceOff: pub.forceOff,
      paymentWindowHours: 3,
      awaitingCount: awaiting.length,
      token: {
        configured: pub.tokenConfigured,
        valid: tokenValid,
        last4: pub.tokenLast4,
        fromEnv: pub.tokenFromEnv,
        merchantName,
      },
      webhook,
    },
    feed,
    awaiting,
  };
}

export type { PaymentJournalEntry };
