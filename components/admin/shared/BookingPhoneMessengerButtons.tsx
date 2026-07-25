"use client";

import { normalizeGuestPhone } from "@/lib/admin/guestMessengerLinks";
import { MessengerIcon } from "./MessengerButtons";

type Props = {
  phone: string;
};

/**
 * Кнопки «Telegram / WhatsApp» під полем «Телефон» у деталях броні.
 * Візуал 1:1 з розділом «Гості»: відкриває месенджер на введений номер.
 */
export function BookingPhoneMessengerButtons({ phone }: Props) {
  const digits = normalizeGuestPhone(phone);
  if (digits.length < 10) return null;

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <a
        href={`https://t.me/+${digits}`}
        target="_blank"
        rel="noreferrer"
        className="btn-action"
        style={{
          background: "#EFF6FF",
          color: "#2563EB",
          fontWeight: 600,
          fontSize: 13,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          border: "1px solid #BFDBFE",
          textDecoration: "none",
        }}
      >
        <MessengerIcon kind="telegram" size={14} />
        Telegram
      </a>
      <a
        href={`https://wa.me/${digits}`}
        target="_blank"
        rel="noreferrer"
        className="btn-action"
        style={{
          background: "#DCFCE7",
          color: "#059669",
          fontWeight: 600,
          fontSize: 13,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          border: "1px solid #A7F3D0",
          textDecoration: "none",
        }}
      >
        <MessengerIcon kind="whatsapp" size={14} />
        WhatsApp
      </a>
    </div>
  );
}
