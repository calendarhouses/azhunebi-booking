"use client";

import { useMemo } from "react";
import { buildGuestsFromBookings, formatGuestLastVisit, getVisitWord, type GuestRow } from "../desktop/guestData";
import type { BookingRecord } from "../desktop/types";

type GuestAutocompleteDropdownProps = {
  bookings: BookingRecord[];
  searchTerm: string;
  open: boolean;
  onSelect: (guest: GuestRow) => void;
  /** Skip the guest that exactly matches the currently loaded booking (editing an existing one). */
  excludePhone?: string;
};

const MIN_CHARS = 2;
const MAX_RESULTS = 6;

/**
 * Suggestions filtered client-side from bookings already in admin memory —
 * no extra GAS round-trip. See lib/admin/guestCrmRules.ts.
 */
export function GuestAutocompleteDropdown({
  bookings,
  searchTerm,
  open,
  onSelect,
  excludePhone,
}: GuestAutocompleteDropdownProps) {
  const results = useMemo(() => {
    const term = searchTerm.trim();
    if (term.length < MIN_CHARS) return [];
    const guests = buildGuestsFromBookings(bookings, term);
    const filtered = excludePhone
      ? guests.filter((g) => g.phone !== excludePhone)
      : guests;
    return filtered.slice(0, MAX_RESULTS);
  }, [bookings, searchTerm, excludePhone]);

  if (!open || results.length === 0) return null;

  return (
    <div
      className="custom-select-options"
      style={{
        opacity: 1,
        visibility: "visible",
        transform: "none",
        display: "block",
      }}
      // Prevent the input's onBlur from firing before the click is registered.
      onMouseDown={(e) => e.preventDefault()}
    >
      {results.map((g) => (
        <div
          key={g.phone}
          className="custom-option"
          onClick={() => onSelect(g)}
        >
          <span>{g.name || "Без імені"}</span>
          <span style={{ color: "#9CA3AF", fontSize: 12, fontWeight: 500 }}>
            +{g.phone} · {g.count} {getVisitWord(g.count)} · {formatGuestLastVisit(g.lastVisit)}
          </span>
        </div>
      ))}
    </div>
  );
}
