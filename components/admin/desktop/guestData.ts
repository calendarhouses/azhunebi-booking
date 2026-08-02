import { formatPhone, parseSafeDate } from "./adminDates";
import { getVisitWord } from "./adminPlural";
import type { BookingRecord } from "./types";
import {
  getGuestProfile,
  type GuestProfile,
  type GuestProfilesMap,
  type GuestRating,
} from "@/lib/admin/guestProfiles";

export type GuestRow = {
  name: string;
  phone: string;
  count: number;
  lastVisit: Date;
  rating?: GuestRating;
  note?: string;
};

export function buildGuestsFromBookings(
  bookings: BookingRecord[],
  searchTerm = "",
  profiles?: GuestProfilesMap | null,
  ratingFilter?: GuestRating | null
): GuestRow[] {
  const guestsMap: Record<string, GuestRow> = {};

  for (const b of bookings) {
    const rawPhone = String(b.phone || "").trim();
    if (!rawPhone) continue;
    const phoneKey = formatPhone(rawPhone);
    const name = String(b.name || "").replace(" (Ручна бронь)", "").trim();
    if (!guestsMap[phoneKey]) {
      guestsMap[phoneKey] = { name, phone: phoneKey, count: 0, lastVisit: new Date(0) };
    }
    if (!String(b.status).toLowerCase().includes("скас")) guestsMap[phoneKey].count++;
    const currentCheckIn = parseSafeDate(b.checkIn);
    if (!isNaN(currentCheckIn.getTime()) && currentCheckIn > guestsMap[phoneKey].lastVisit) {
      guestsMap[phoneKey].lastVisit = currentCheckIn;
      if (name) guestsMap[phoneKey].name = name;
    }
  }

  let guests = Object.values(guestsMap).map((g) => {
    const profile = getGuestProfile(profiles, g.phone);
    return mergeGuestProfile(g, profile);
  });

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    const digits = searchTerm.replace(/\D/g, "");
    guests = guests.filter(
      (g) =>
        g.name.toLowerCase().includes(term) ||
        (digits.length >= 2 && g.phone.includes(digits)) ||
        g.phone.includes(term)
    );
  }

  if (ratingFilter === 1 || ratingFilter === 2 || ratingFilter === 3) {
    guests = guests.filter((g) => g.rating === ratingFilter);
  }

  return guests.sort((a, b) => b.lastVisit.getTime() - a.lastVisit.getTime());
}

function mergeGuestProfile(row: GuestRow, profile: GuestProfile | null): GuestRow {
  if (!profile) return row;
  return {
    ...row,
    rating: profile.rating,
    note: profile.note ? String(profile.note) : undefined,
  };
}

/** Typeahead search by name or phone (min ~2 meaningful chars). */
export function searchGuests(
  bookings: BookingRecord[],
  query: string,
  limit = 8,
  profiles?: GuestProfilesMap | null
): GuestRow[] {
  const q = String(query || "").trim();
  if (q.length < 2) return [];
  return buildGuestsFromBookings(bookings, q, profiles).slice(0, limit);
}

/** Find guest profile by phone digits (matches Guests section logic). */
export function lookupGuestByPhone(
  bookings: BookingRecord[],
  rawPhone: string,
  profiles?: GuestProfilesMap | null
): GuestRow | null {
  const phoneKey = formatPhone(rawPhone);
  if (!phoneKey) return null;
  const guests = buildGuestsFromBookings(bookings, "", profiles);
  return guests.find((g) => g.phone === phoneKey) ?? null;
}

export function formatGuestLastVisit(d: Date): string {
  return d.getFullYear() > 2000
    ? d.toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" })
    : "Немає заїздів";
}

export { getVisitWord };
