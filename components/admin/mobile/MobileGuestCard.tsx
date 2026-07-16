"use client";

import { getVisitWord } from "../desktop/guestData";
import { copyToClipboard } from "../desktop/bookingUtils";
import { MessengerIcon } from "../shared/MessengerButtons";

const iconPhone = (
  <svg width="14" height="14" fill="none" stroke="#9CA3AF" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
    />
  </svg>
);

function telHref(phone: string): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 9) return null;
  return `tel:+${digits}`;
}

export interface MobileGuestCardProps {
  name: string;
  phone: string;
  count: number;
  lastVisitLabel?: string;
  onShowBookings?: (phone: string, name: string) => void;
}

export function MobileGuestCard({
  name,
  phone,
  count,
  lastVisitLabel,
  onShowBookings,
}: MobileGuestCardProps) {
  const initial = name.charAt(0).toUpperCase() || "👤";
  const callHref = telHref(phone);

  return (
    <article className="boso-mobile-card boso-mobile-guest-card">
      <div className="boso-mobile-card__guest-header">
        <div className="boso-mobile-card__guest-main">
          <div className="boso-mobile-card__avatar">{initial}</div>
          <div className="boso-mobile-card__guest-text">
            <strong className="boso-mobile-card__name">{name}</strong>
            <button
              type="button"
              className="boso-mobile-card__phone tap-btn"
              onClick={(e) => void copyToClipboard(`+${phone}`, e)}
            >
              {iconPhone}+{phone}
            </button>
            {lastVisitLabel ? (
              <span className="boso-mobile-card__last-visit">{lastVisitLabel}</span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="badge new tap-btn boso-mobile-card__visits"
          onClick={() => onShowBookings?.(phone, name)}
        >
          {count} {getVisitWord(count)}
        </button>
      </div>

      <div className="boso-mobile-card__messengers">
        {callHref ? (
          <a href={callHref} className="btn-action tap-btn boso-mobile-card__call">
            Дзвінок
          </a>
        ) : null}
        <a
          href={`https://t.me/+${phone}`}
          target="_blank"
          rel="noreferrer"
          className="btn-action tap-btn boso-mobile-card__tg"
        >
          <MessengerIcon kind="telegram" size={16} />
          Telegram
        </a>
        <a
          href={`https://wa.me/${phone}`}
          target="_blank"
          rel="noreferrer"
          className="btn-action tap-btn boso-mobile-card__wa"
        >
          <MessengerIcon kind="whatsapp" size={16} />
          WhatsApp
        </a>
      </div>

      {onShowBookings ? (
        <button
          type="button"
          className="btn-secondary tap-btn boso-mobile-card__show-bookings"
          onClick={() => onShowBookings(phone, name)}
        >
          Показати броні
        </button>
      ) : null}
    </article>
  );
}
