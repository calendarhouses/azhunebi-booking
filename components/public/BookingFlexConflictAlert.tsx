"use client";

import { toSafePublicRichHtml } from "@/lib/public-booking/publicToast";

export function BookingFlexConflictAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      className="booking-alert booking-alert--warn"
      role="status"
      dangerouslySetInnerHTML={{ __html: toSafePublicRichHtml(message) }}
    />
  );
}
