"use client";

import { parseSafeDate } from "../desktop/adminDates";
import { nightWord } from "../desktop/adminPlural";
import {
  copyToClipboard,
  displayClientName,
  displayPhone,
  getBookingBadgeClass,
} from "../desktop/bookingUtils";
import type { BookingRecord } from "../desktop/types";
import { iconCalMobile, iconMoonMobile, iconPhoneMobile } from "./mobileBookingRowIcons";

function telHref(phone: string): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 9) return null;
  return `tel:+${digits}`;
}

export interface MobileBookingCardProps {
  booking: BookingRecord;
  onOpen: (event: React.MouseEvent | null, row: number | string) => void;
}

export function MobileBookingCard({ booking: b, onOpen }: MobileBookingCardProps) {
  const inDate = parseSafeDate(b.checkIn);
  const outDate = parseSafeDate(b.checkOut);
  const nights = Math.round((outDate.getTime() - inDate.getTime()) / 86400000) || 0;
  const dateStr = `${inDate.toLocaleDateString("uk-UA", { day: "numeric", month: "long" })} - ${outDate.toLocaleDateString("uk-UA", { day: "numeric", month: "long" })}`;
  const badgeClass = getBookingBadgeClass(b);
  const clientName = displayClientName(b.name);
  const initial = clientName.charAt(0).toUpperCase() || "👤";
  const phoneDisplay = displayPhone(b.phone);
  const callHref = telHref(String(b.phone || ""));

  return (
    <article className="boso-mobile-card boso-mobile-booking-card">
      <div className="boso-mobile-card__dates">
        <div className="boso-mobile-card__dates-left">
          <div className="boso-mobile-card__icon-box">{iconCalMobile}</div>
          <strong>{dateStr}</strong>
        </div>
        <div className="boso-mobile-card__nights">
          {iconMoonMobile} {nights} {nightWord(nights)}
        </div>
      </div>

      <div className="boso-mobile-card__guest-row">
        <div className="boso-mobile-card__guest-main">
          <div className="boso-mobile-card__avatar boso-mobile-card__avatar--booking">{initial}</div>
          <div className="boso-mobile-card__guest-text">
            <div className="boso-mobile-card__name">{clientName}</div>
            <button
              type="button"
              className="boso-mobile-card__phone tap-btn"
              onClick={(e) => void copyToClipboard(phoneDisplay, e)}
            >
              {iconPhoneMobile} {phoneDisplay}
            </button>
          </div>
        </div>
        <div className="boso-mobile-card__cottage-wrap">
          <span className="boso-mobile-card__cottage">{b.cottage}</span>
        </div>
      </div>

      <div className="boso-mobile-card__actions">
        <div className={`badge ${badgeClass} boso-mobile-card__status`}>{b.status}</div>
        <div className="boso-mobile-card__action-btns">
          {callHref ? (
            <a href={callHref} className="btn-action tap-btn boso-mobile-card__call" aria-label="Зателефонувати">
              Дзвінок
            </a>
          ) : null}
          <button
            type="button"
            className="btn-primary tap-btn boso-mobile-card__details"
            onClick={(e) => onOpen(e, b.id || b.row)}
          >
            Деталі
          </button>
        </div>
      </div>
    </article>
  );
}
