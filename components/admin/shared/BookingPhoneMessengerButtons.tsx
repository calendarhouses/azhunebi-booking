"use client";

import type { CSSProperties } from "react";
import { normalizeGuestPhone } from "@/lib/admin/guestMessengerLinks";
import { MessengerIcon } from "./MessengerButtons";

type Props = {
  phone: string;
  /** Call button — mobile booking details only. */
  showCall?: boolean;
};

const iconPhoneAction = (
  <svg
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    aria-hidden="true"
    style={{ display: "block", flexShrink: 0 }}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
    />
  </svg>
);

/** Same chrome as Telegram / WhatsApp — soft fill + 1px border + 600 weight. */
const btnBase: CSSProperties = {
  fontWeight: 600,
  fontSize: 13,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  textDecoration: "none",
  flex: 1,
  minWidth: 0,
  padding: "8px 12px",
  borderRadius: 8,
  boxSizing: "border-box",
};

/**
 * Кнопки під полем «Телефон» у деталях броні.
 */
export function BookingPhoneMessengerButtons({ phone, showCall = false }: Props) {
  const digits = normalizeGuestPhone(phone);
  if (digits.length < 10) return null;

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8, width: "100%" }}>
      <a
        href={`https://t.me/+${digits}`}
        target="_blank"
        rel="noreferrer"
        className="btn-action tap-btn"
        style={{
          ...btnBase,
          background: "#EFF6FF",
          color: "#2563EB",
          border: "1px solid #BFDBFE",
        }}
      >
        <MessengerIcon kind="telegram" size={14} />
        Telegram
      </a>
      <a
        href={`https://wa.me/${digits}`}
        target="_blank"
        rel="noreferrer"
        className="btn-action tap-btn"
        style={{
          ...btnBase,
          background: "#DCFCE7",
          color: "#059669",
          border: "1px solid #A7F3D0",
        }}
      >
        <MessengerIcon kind="whatsapp" size={14} />
        WhatsApp
      </a>
      {showCall ? (
        <a
          href={`tel:+${digits}`}
          className="btn-action tap-btn"
          aria-label="Зателефонувати"
          style={{
            ...btnBase,
            background: "#F0FDF4",
            color: "#15803D",
            border: "1px solid #BBF7D0",
          }}
        >
          {iconPhoneAction}
          Дзвінок
        </a>
      ) : null}
    </div>
  );
}
