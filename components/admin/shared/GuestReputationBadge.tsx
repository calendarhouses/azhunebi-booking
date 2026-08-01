"use client";

import { useMemo } from "react";
import {
  buildGuestReputation,
  getGuestReputationTier,
  GUEST_REPUTATION_EMOJI,
  GUEST_REPUTATION_LABEL,
} from "../desktop/guestData";
import type { BookingRecord } from "../desktop/types";

type GuestReputationBadgeProps = {
  bookings: BookingRecord[];
  phone: string;
};

/**
 * Emoji indicator next to the guest name — derived purely from bookings
 * already loaded into admin state. No extra GAS calls, no new sheets/keys.
 */
export function GuestReputationBadge({ bookings, phone }: GuestReputationBadgeProps) {
  const tier = useMemo(() => {
    const rep = buildGuestReputation(bookings, phone);
    return getGuestReputationTier(rep);
  }, [bookings, phone]);

  if (tier === "new") return null;

  return (
    <span
      title={GUEST_REPUTATION_LABEL[tier]}
      aria-label={GUEST_REPUTATION_LABEL[tier]}
      style={{
        marginLeft: 6,
        fontSize: 14,
        cursor: "default",
        verticalAlign: "middle",
      }}
    >
      {GUEST_REPUTATION_EMOJI[tier]}
    </span>
  );
}
