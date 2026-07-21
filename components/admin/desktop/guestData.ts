import { formatPhone, parseSafeDate } from "./adminDates";
import { getVisitWord } from "./adminPlural";
import type { BookingRecord } from "./types";

export type GuestRow = {
  name: string;
  phone: string;
  count: number;
  lastVisit: Date;
};

export function buildGuestsFromBookings(bookings: BookingRecord[], searchTerm = ""): GuestRow[] {
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

  let guests = Object.values(guestsMap);
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    guests = guests.filter(
      (g) => g.name.toLowerCase().includes(term) || g.phone.includes(term)
    );
  }
  return guests.sort((a, b) => b.lastVisit.getTime() - a.lastVisit.getTime());
}

/** Find guest profile by phone digits (matches Guests section logic). */
export function lookupGuestByPhone(
  bookings: BookingRecord[],
  rawPhone: string,
): GuestRow | null {
  const phoneKey = formatPhone(rawPhone);
  if (!phoneKey) return null;
  const guests = buildGuestsFromBookings(bookings);
  return guests.find((g) => g.phone === phoneKey) ?? null;
}

export function formatGuestLastVisit(d: Date): string {
  return d.getFullYear() > 2000
    ? d.toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" })
    : "Немає заїздів";
}

export { getVisitWord };
