"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { buildGuestsFromBookings, formatGuestLastVisit, getVisitWord } from "../guestData";
import { copyToClipboard } from "../bookingUtils";
import { MobileGuestCard } from "../../mobile/MobileGuestCard";
import { MessengerIcon } from "../../shared/MessengerButtons";
import {
  GuestRatingBadge,
  GuestReputationControls,
} from "../../shared/GuestReputationControls";
import type { BookingRecord } from "../types";
import type { GuestProfilesMap, GuestRating } from "@/lib/admin/guestProfiles";

const iconPhone = (
  <svg width="14" height="14" fill="none" stroke="#9CA3AF" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
    />
  </svg>
);

export interface DesktopGuestsViewProps {
  style?: CSSProperties;
  layout?: "desktop" | "mobile";
  bookings?: BookingRecord[];
  guestProfiles?: GuestProfilesMap | null;
  onUpsertGuestProfile?: (
    phone: string,
    patch: { rating?: GuestRating | null; note?: string | null }
  ) => void;
  onShowGuestBookings?: (phone: string, name: string) => void;
}

export function DesktopGuestsView({
  style,
  layout = "desktop",
  bookings = [],
  guestProfiles,
  onUpsertGuestProfile,
  onShowGuestBookings,
}: DesktopGuestsViewProps) {
  const isMobile = layout === "mobile";
  const [search, setSearch] = useState("");

  const guests = useMemo(
    () => buildGuestsFromBookings(bookings, search, guestProfiles),
    [bookings, search, guestProfiles]
  );

  return (
    <div id="view-guests" className={isMobile ? undefined : "card"} style={style}>
      {isMobile ? (
        <input
          type="text"
          id="guestSearch"
          placeholder="Пошук за ім'ям або телефоном..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 12,
            border: "1px solid #D1D5DB",
            marginBottom: 16,
            fontSize: 14,
            background: "#FFF",
          }}
        />
      ) : (
        <div className="toolbar">
          <input
            type="text"
            id="guestSearch"
            placeholder="Пошук за ім'ям або телефоном..."
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}
      {isMobile ? (
        <div className="boso-mobile-card-list" id="guestsTableBody">
          {guests.length === 0 ? (
            <div className="boso-mobile-card-empty">Гостей не знайдено</div>
          ) : (
            guests.map((g) => (
              <MobileGuestCard
                key={g.phone}
                name={g.name}
                phone={g.phone}
                count={g.count}
                rating={g.rating}
                note={g.note}
                lastVisitLabel={formatGuestLastVisit(g.lastVisit)}
                onShowBookings={onShowGuestBookings}
                onUpsertProfile={onUpsertGuestProfile}
              />
            ))
          )}
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ім&apos;я Клієнта</th>
              <th>Рейтинг</th>
              <th>Телефон</th>
              <th>Статистика</th>
              <th>Остання бронь</th>
              <th>Дія</th>
            </tr>
          </thead>
          <tbody id="guestsTableBody">
            {guests.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 30, color: "#9CA3AF" }}>
                  Гостей не знайдено
                </td>
              </tr>
            ) : (
              guests.map((g) => {
                const cleanPhone = g.phone;
                const initial = g.name.charAt(0).toUpperCase() || "👤";
                return (
                  <tr
                    key={cleanPhone}
                    style={{ transition: "background 0.2s ease" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#F9FAFB";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: "#F3F4F6",
                            color: "#4B5563",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: 14,
                            flexShrink: 0,
                          }}
                        >
                          {initial}
                        </div>
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              color: "var(--text-main)",
                              fontSize: 14,
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            {g.name}
                            <GuestRatingBadge rating={g.rating} note={g.note} />
                          </div>
                          {g.note ? (
                            <div className="guest-note-preview" title={g.note}>
                              {g.note}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px", verticalAlign: "middle" }}>
                      <GuestReputationControls
                        phone={cleanPhone}
                        profile={{ rating: g.rating, note: g.note }}
                        onChange={(patch) => onUpsertGuestProfile?.(cleanPhone, patch)}
                        compact
                      />
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <div
                        role="button"
                        tabIndex={0}
                        title="Скопіювати номер"
                        style={{
                          cursor: "pointer",
                          borderRadius: 6,
                          padding: "2px 6px",
                          marginLeft: -6,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          color: "#6B7280",
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                        onClick={(e) => void copyToClipboard(`+${cleanPhone}`, e)}
                      >
                        {iconPhone}+{cleanPhone}
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <span
                        className="badge new"
                        style={{
                          cursor: "pointer",
                          transition: "0.2s",
                          padding: "6px 12px",
                          boxShadow: "0 2px 4px rgba(30, 64, 175, 0.1)",
                        }}
                        onClick={() => onShowGuestBookings?.(cleanPhone, g.name)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.05)";
                          e.currentTarget.style.background = "#BFDBFE";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.background = "";
                        }}
                      >
                        {g.count} {getVisitWord(g.count)}
                      </span>
                    </td>
                    <td style={{ padding: "16px 20px", color: "#6B7280", fontSize: 13, fontWeight: 500 }}>
                      {formatGuestLastVisit(g.lastVisit)}
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <a
                          href={`https://t.me/+${cleanPhone}`}
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
                          }}
                        >
                          <MessengerIcon kind="telegram" size={14} />
                          Telegram
                        </a>
                        <a
                          href={`https://wa.me/${cleanPhone}`}
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
                          }}
                        >
                          <MessengerIcon kind="whatsapp" size={14} />
                          WhatsApp
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
