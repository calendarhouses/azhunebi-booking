"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { buildGuestsFromBookings, formatGuestLastVisit, getVisitWord } from "../guestData";
import { copyToClipboard } from "../bookingUtils";
import { MobileGuestCard } from "../../mobile/MobileGuestCard";
import { MessengerIcon } from "../../shared/MessengerButtons";
import { GuestReputationControls } from "../../shared/GuestReputationControls";
import { GuestFaceIcon } from "../../shared/GuestIcons";
import { guestRatingMeta, type GuestProfilesMap, type GuestRating } from "@/lib/admin/guestProfiles";
import type { BookingRecord } from "../types";

const FILTER_RATINGS: GuestRating[] = [3, 2, 1];

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
  const [ratingFilter, setRatingFilter] = useState<GuestRating | null>(null);

  const guests = useMemo(
    () => buildGuestsFromBookings(bookings, search, guestProfiles, ratingFilter),
    [bookings, search, guestProfiles, ratingFilter]
  );

  const ratingFilterBar = (
    <div
      className={`guests-rating-filter${isMobile ? " guests-rating-filter--mobile" : ""}`}
      role="group"
      aria-label="Фільтр за оцінкою гостя"
    >
      <span className="guests-rating-filter__label">Оцінка</span>
      <div className="guests-rating-filter__faces">
        {FILTER_RATINGS.map((r) => {
          const meta = guestRatingMeta(r)!;
          const selected = ratingFilter === r;
          return (
            <button
              key={r}
              type="button"
              className={`guests-rating-filter__face guests-rating-filter__face--${meta.tone}${selected ? " is-selected" : ""}`}
              title={selected ? `Показати всіх (зараз: ${meta.label})` : `Показати: ${meta.label}`}
              aria-pressed={selected}
              onClick={() => setRatingFilter((prev) => (prev === r ? null : r))}
            >
              <GuestFaceIcon rating={r} size={isMobile ? 20 : 18} />
            </button>
          );
        })}
      </div>
      {ratingFilter ? (
        <button
          type="button"
          className="guests-rating-filter__clear"
          onClick={() => setRatingFilter(null)}
        >
          Скинути
        </button>
      ) : null}
    </div>
  );

  return (
    <div id="view-guests" className={isMobile ? undefined : "card guests-view"} style={style}>
      {isMobile ? (
        <div className="guests-toolbar guests-toolbar--mobile">
          <input
            type="text"
            id="guestSearch"
            placeholder="Пошук за ім'ям або телефоном..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="guests-toolbar__search-mobile"
          />
          {ratingFilterBar}
        </div>
      ) : (
        <div className="toolbar guests-toolbar">
          <input
            type="text"
            id="guestSearch"
            placeholder="Пошук за ім'ям або телефоном..."
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {ratingFilterBar}
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
        <div className="guests-table-wrap">
          <table className="guests-table">
            <thead>
              <tr>
                <th>Клієнт</th>
                <th>Телефон</th>
                <th>Статистика</th>
                <th>Остання бронь</th>
                <th>Дія</th>
              </tr>
            </thead>
            <tbody id="guestsTableBody">
              {guests.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 30, color: "#9CA3AF" }}>
                    Гостей не знайдено
                  </td>
                </tr>
              ) : (
                guests.map((g) => {
                  const cleanPhone = g.phone;
                  const initial = g.name.charAt(0).toUpperCase() || "?";
                  return (
                    <tr key={cleanPhone}>
                      <td>
                        <div className="guests-table__client">
                          <div className="guests-table__avatar">{initial}</div>
                          <div className="guests-table__client-body">
                            <div className="guests-table__name">{g.name}</div>
                            <div className="guests-table__rep">
                              <GuestReputationControls
                                phone={cleanPhone}
                                profile={{ rating: g.rating, note: g.note }}
                                onChange={(patch) => onUpsertGuestProfile?.(cleanPhone, patch)}
                                compact
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="guests-table__phone"
                          title="Скопіювати номер"
                          onClick={(e) => void copyToClipboard(`+${cleanPhone}`, e)}
                        >
                          {iconPhone}+{cleanPhone}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="badge new guests-table__stat"
                          onClick={() => onShowGuestBookings?.(cleanPhone, g.name)}
                        >
                          {g.count} {getVisitWord(g.count)}
                        </button>
                      </td>
                      <td className="guests-table__date">{formatGuestLastVisit(g.lastVisit)}</td>
                      <td>
                        <div className="guests-table__actions">
                          <a
                            href={`https://t.me/+${cleanPhone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="guests-table__msg guests-table__msg--tg"
                            title="Telegram"
                            aria-label="Telegram"
                          >
                            <MessengerIcon kind="telegram" size={15} />
                          </a>
                          <a
                            href={`https://wa.me/${cleanPhone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="guests-table__msg guests-table__msg--wa"
                            title="WhatsApp"
                            aria-label="WhatsApp"
                          >
                            <MessengerIcon kind="whatsapp" size={15} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
