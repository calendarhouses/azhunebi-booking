"use client";

import { Phone } from "lucide-react";
import { formatPhone } from "../adminDates";
import { copyToClipboard } from "../bookingUtils";
import { getVisitWord, lookupGuestByPhone } from "../guestData";
import type { BookingRecord } from "../types";

type SmsJournalGuestCellProps = {
  phone: string;
  bookings?: BookingRecord[];
  onShowGuestBookings?: (phone: string, name: string) => void;
};

function displayPhone(phone: string): string {
  const clean = formatPhone(phone);
  return clean ? `+${clean}` : phone;
}

export function SmsJournalGuestCell({
  phone,
  bookings = [],
  onShowGuestBookings,
}: SmsJournalGuestCellProps) {
  const guest = lookupGuestByPhone(bookings, phone);
  const showProfile = Boolean(guest && guest.count > 0 && guest.name);
  const cleanPhone = formatPhone(phone);
  const phoneDisplay = displayPhone(phone);
  const initial = (guest?.name || "?").charAt(0).toUpperCase();

  return (
    <aside className="sms-journal-guest">
      {showProfile ? (
        <div className="sms-journal-guest__profile">
          <div className="sms-journal-guest__avatar" aria-hidden>
            {initial}
          </div>
          <div className="sms-journal-guest__name">{guest!.name}</div>
        </div>
      ) : null}

      <button
        type="button"
        className="sms-journal-guest__phone tap-btn"
        title="Скопіювати номер"
        onClick={(e) => void copyToClipboard(phoneDisplay, e)}
      >
        <Phone size={14} strokeWidth={2} aria-hidden />
        <span>{phoneDisplay}</span>
      </button>

      {showProfile && onShowGuestBookings ? (
        <button
          type="button"
          className="sms-journal-guest__bookings tap-btn"
          onClick={() => onShowGuestBookings(cleanPhone, guest!.name)}
        >
          {guest!.count} {getVisitWord(guest!.count)}
        </button>
      ) : null}
    </aside>
  );
}
