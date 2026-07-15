"use client";

import { useCallback } from "react";
import {
  buildGuestMessengerLinks,
  type GuestMessengerBooking,
} from "@/lib/admin/guestMessengerLinks";
import { MessengerIcon } from "./MessengerButtons";

const VIBER_PATH =
  "M11.4 0C9.5.1 7.6.6 6 .9 4.4 1.2 3 2.5 2.3 4.1.6 7.3.1 10.7 0 14.2c0 3.5.6 6.9 2.3 10.1.7 1.6 2.1 2.9 3.7 3.2 1.6.3 3.5.8 5.4.9 1.9.1 3.8-.2 5.6-.8 1.8-.6 3.4-1.6 4.7-2.9 1.3-1.3 2.3-2.9 2.9-4.7.6-1.8.9-3.7.8-5.6-.1-1.9-.6-3.8-.9-5.4-.3-1.6-1.6-3-3.2-3.7C18.3.6 14.9 0 11.4 0zm.3 4.8c2.8 0 5 2.2 5 5s-2.2 5-5 5-5-2.2-5-5 2.2-5 5-5z";

function ViberIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d={VIBER_PATH} />
    </svg>
  );
}

type Props = {
  booking: GuestMessengerBooking;
  compact?: boolean;
};

export function GuestMessengerButtons({ booking, compact = false }: Props) {
  const links = buildGuestMessengerLinks(booking, {
    includePaymentLink: false,
    approved: true,
  });

  const copyTelegramMessage = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(links.message);
      alert("Текст скопійовано — вставте в чат Telegram");
    } catch {
      alert(links.message);
    }
  }, [links.message]);

  const btnStyle = compact
    ? {
        fontSize: 12,
        padding: "8px 10px",
      }
    : {
        fontSize: 13,
        padding: "10px 14px",
      };

  return (
    <div>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 10, lineHeight: 1.5 }}>
        Надішліть гостю посилання на оплату через месенджер:
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <a
          href={links.whatsapp}
          target="_blank"
          rel="noreferrer"
          className="btn-action"
          style={{
            ...btnStyle,
            background: "#DCFCE7",
            color: "#059669",
            fontWeight: 600,
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
        <a
          href={links.viber}
          target="_blank"
          rel="noreferrer"
          className="btn-action"
          style={{
            ...btnStyle,
            background: "#F3E8FF",
            color: "#7C3AED",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: "1px solid #DDD6FE",
            textDecoration: "none",
          }}
        >
          <ViberIcon size={14} />
          Viber
        </a>
        <button
          type="button"
          className="btn-action"
          onClick={() => {
            void copyTelegramMessage();
            window.open(links.telegram, "_blank", "noopener,noreferrer");
          }}
          style={{
            ...btnStyle,
            background: "#EFF6FF",
            color: "#2563EB",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: "1px solid #BFDBFE",
            cursor: "pointer",
          }}
        >
          <MessengerIcon kind="telegram" size={14} />
          Telegram
        </button>
      </div>
    </div>
  );
}
