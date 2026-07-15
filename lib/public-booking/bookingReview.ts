import type { CustomServiceConfig } from "@/components/admin/desktop/types";
import type { ServiceSelectionMap } from "@/components/admin/desktop/settings/additionalServicesLogic";

export const BOOKING_STATUS_PENDING_REVIEW = "Очікує підтвердження";
export const BOOKING_STATUS_AWAITING_PAYMENT = "Очікує оплату";

export type PublicBookingFlow = "instant" | "pending_review";

export type ReviewCheckInput = {
  nights: number;
  earlyTime: string | null;
  lateTime: string | null;
  flexibleRequiresApproval: boolean;
  selectedServices: ServiceSelectionMap;
  servicesById: Map<string, CustomServiceConfig>;
  hasUbd: boolean;
};

/** Бронь потребує ручного підтвердження адміном перед оплатою. */
export function needsManualReview(input: ReviewCheckInput): boolean {
  if (input.nights === 1) return true;
  if (input.flexibleRequiresApproval && (input.earlyTime || input.lateTime)) return true;
  for (const [id, qty] of Object.entries(input.selectedServices)) {
    if (!qty || qty <= 0) continue;
    const service = input.servicesById.get(id);
    if (service?.requiresApproval) return true;
  }
  if (input.hasUbd && input.nights === 1) return true;
  return false;
}

export function isPendingReviewStatus(status: string | undefined | null): boolean {
  const s = String(status || "").toLowerCase().trim();
  return s.includes("очікує підтвердження");
}

export function isAwaitingPaymentStatus(status: string | undefined | null): boolean {
  const s = String(status || "").toLowerCase();
  return s.includes("очікує оплату");
}
