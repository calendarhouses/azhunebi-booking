import { parseSafeDate } from "@/components/admin/desktop/adminDates";
import {
  calculatePrepaymentAmount,
  readPrepaymentPolicy,
} from "@/lib/public-booking/prepaymentPolicy";
import type { PublicBranding } from "@/lib/public-booking/types";

/**
 * Amount to charge as «передплата» on /pay and Mono invoices.
 * Uses the booking field when set; otherwise the public prepayment policy
 * (same as the site) — so admin-created unpaid links still get prepay + full.
 */
export function resolvePayablePrepayAmount(
  booking: {
    prepayAmount?: unknown;
    totalPrice?: unknown;
    basePrice?: unknown;
    checkIn?: unknown;
    checkOut?: unknown;
  },
  branding?: PublicBranding | null
): number {
  const total = Math.round(Number(booking.totalPrice) || 0);
  const stored = Math.round(Number(booking.prepayAmount) || 0);
  if (stored > 0) return total > 0 ? Math.min(stored, total) : stored;
  if (total <= 0) return 0;

  const policy = readPrepaymentPolicy(branding);
  if (policy.value <= 0) return 0;

  const checkIn = parseSafeDate(String(booking.checkIn || ""));
  const checkOut = parseSafeDate(String(booking.checkOut || ""));
  const nights =
    !Number.isNaN(checkIn.getTime()) && !Number.isNaN(checkOut.getTime())
      ? Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000))
      : 1;
  const baseFromField = Math.round(Number(booking.basePrice) || 0);
  const fromPolicy = calculatePrepaymentAmount(policy, {
    totalPrice: total,
    basePriceTotal: baseFromField > 0 ? baseFromField : total,
    nights,
  });
  if (fromPolicy > 0) return Math.min(total, fromPolicy);
  return Math.min(total, Math.round(total / 2));
}
