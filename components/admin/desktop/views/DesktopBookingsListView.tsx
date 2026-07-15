"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { parseSafeDate } from "../adminDates";
import { nightWord } from "../adminPlural";
import {
  copyToClipboard,
  displayClientName,
  displayPhone,
  findRoomForBooking,
  filterBookingsList,
  getBookingBadgeClass,
  sortBookingsByCheckIn,
} from "../bookingUtils";
import { bookingMoveKey } from "../timelineBookingMove";
import type { BookingRecord, RoomConfig } from "../types";
import { MobileBookingCard } from "../../mobile/MobileBookingCard";

const iconMoon = (
  <svg width="14" height="14" fill="none" stroke="#9CA3AF" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

const iconPhone = (
  <svg width="14" height="14" fill="none" stroke="#9CA3AF" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
    />
  </svg>
);

const iconHome = (
  <svg width="14" height="14" fill="none" stroke="#9CA3AF" strokeWidth="2" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  </svg>
);

export type BookingListFilter = "all" | "future" | "cancelled";

export interface DesktopBookingsListViewProps {
  style?: CSSProperties;
  layout?: "desktop" | "mobile";
  bookings?: BookingRecord[];
  roomsList?: RoomConfig[];
  onOpenBooking: (event: React.MouseEvent | null, row: number | string) => void;
  guestFilter?: { name: string; phone: string } | null;
  onClearGuestFilter?: () => void;
}

export function DesktopBookingsListView({
  style,
  layout = "desktop",
  bookings = [],
  roomsList = [],
  onOpenBooking,
  guestFilter = null,
  onClearGuestFilter,
}: DesktopBookingsListViewProps) {
  const isMobile = layout === "mobile";
  const [filter, setFilter] = useState<BookingListFilter>("all");

  const rows = useMemo(() => {
    let data = filterBookingsList(bookings, filter);
    if (guestFilter) {
      const phone = guestFilter.phone.replace(/\D/g, "");
      data = bookings.filter((b) => {
        const p = String(b.phone || "").replace(/\D/g, "");
        return p === phone;
      });
    }
    return sortBookingsByCheckIn(data);
  }, [bookings, filter, guestFilter]);

  return (
    <div id="view-list" className={isMobile ? undefined : "card"} style={style}>
      <div
        className={isMobile ? "mobile-settings-tabs" : "tabs"}
        id="bookingsTabs"
        style={{ display: guestFilter ? "none" : undefined }}
      >
        {(
          [
            ["all", "Всі броні"],
            ["future", "Майбутні"],
            ["cancelled", "Скасовані"],
          ] as const
        ).map(([key, label]) => (
          <div
            key={key}
            className={
              isMobile
                ? `m-tab${filter === key ? " active" : ""}`
                : `tab${filter === key ? " active" : ""}`
            }
            onClick={() => setFilter(key)}
          >
            {label}
          </div>
        ))}
      </div>

      {guestFilter ? (
        <div
          id="guestFilterTab"
          className={isMobile ? "m-card-section guest-filter-banner" : undefined}
          style={
            isMobile
              ? {
                  display: "block",
                  marginBottom: 16,
                  textAlign: "center",
                  borderStyle: "dashed",
                }
              : {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#F9FAFB",
                  padding: "12px 20px",
                  borderRadius: 10,
                  marginBottom: 20,
                  border: "1px dashed #D1D5DB",
                }
          }
        >
          <div style={{ fontSize: 13, color: "#6B7280", marginBottom: isMobile ? 8 : 0 }}>
            {isMobile ? "Броні клієнта: " : "Показано броні клієнта: "}
            <strong id="filterGuestName" style={{ color: "var(--accent)", fontSize: isMobile ? 14 : 16, marginLeft: isMobile ? 4 : 6 }}>
              {guestFilter.name}
            </strong>
          </div>
          <button
            type="button"
            className="btn-secondary tap-btn"
            style={{ padding: isMobile ? "6px 12px" : "8px 16px", fontSize: isMobile ? 12 : 13, height: "auto", width: isMobile ? "auto" : undefined }}
            onClick={() => onClearGuestFilter?.()}
          >
            ✕ Скинути{isMobile ? "" : " фільтр"}
          </button>
        </div>
      ) : null}

      {isMobile ? (
        <div className="boso-mobile-card-list" id="bookingsTableBody">
          {rows.length === 0 ? (
            <div className="boso-mobile-card-empty">Немає броней</div>
          ) : (
            rows.map((b) => (
              <MobileBookingCard key={String(bookingMoveKey(b))} booking={b} onOpen={onOpenBooking} />
            ))
          )}
        </div>
      ) : (
      <table>
        <thead>
            <tr>
              <th>Дати</th>
              <th>Клієнт</th>
              <th>Котедж</th>
              <th>Статус</th>
              <th>Дія</th>
            </tr>
          </thead>
        <tbody id="bookingsTableBody">
          {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 30, color: "#9CA3AF" }}>
                  Нічого не знайдено
                </td>
              </tr>
          ) : (
            rows.map((b) => {
              const inDate = parseSafeDate(b.checkIn);
              const outDate = parseSafeDate(b.checkOut);
              const nights = Math.round((outDate.getTime() - inDate.getTime()) / 86400000) || 0;
              const dateStr = `${inDate.toLocaleDateString("uk-UA", { day: "numeric", month: "long" })} - ${outDate.toLocaleDateString("uk-UA", { day: "numeric", month: "long" })}`;
              const badgeClass = getBookingBadgeClass(b);
              const clientName = displayClientName(b.name);
              const initial = clientName.charAt(0).toUpperCase() || "👤";
              const cleanPhone = displayPhone(b.phone);
              const resolvedRoomName = findRoomForBooking(b, roomsList)?.name || b.cottage;

              return (
                <tr
                  key={String(bookingMoveKey(b))}
                  style={{ transition: "background 0.2s ease" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#F9FAFB";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <td style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontWeight: 600, color: "var(--text-main)", fontSize: 14 }}>{dateStr}</div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          color: "#6B7280",
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        {iconMoon} {nights} {nightWord(nights)}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "#F0FDF4",
                          color: "#059669",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: 14,
                          border: "1px solid #A7F3D0",
                          flexShrink: 0,
                        }}
                      >
                        {initial}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ fontWeight: 600, color: "var(--text-main)", fontSize: 14 }}>{clientName}</div>
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
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                          onClick={(e) => void copyToClipboard(cleanPhone, e)}
                        >
                          {iconPhone} {cleanPhone}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontWeight: 600,
                        color: "#374151",
                        background: "#F3F4F6",
                        padding: "6px 12px",
                        borderRadius: 8,
                        fontSize: 13,
                        width: "max-content",
                      }}
                    >
                      {iconHome} {resolvedRoomName}
                    </div>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <span className={`badge ${badgeClass}`}>{b.status}</span>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <button
                      type="button"
                      className="btn-action arrow"
                      onClick={(e) => onOpenBooking(e, b.id || b.row)}
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #D1D5DB",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                      }}
                    >
                      Деталі{" "}
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
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
