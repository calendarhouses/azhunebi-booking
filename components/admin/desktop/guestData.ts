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

/**
 * Guest reputation — derived entirely from bookings already in memory
 * (client-side, zero extra GAS calls). See lib/admin/guestCrmRules.ts.
 */
export type GuestReputation = {
  phone: string;
  name: string;
  totalCount: number;
  activeCount: number;
  cancelledCount: number;
  lastVisit: Date;
};

export function buildGuestReputation(
  bookings: BookingRecord[],
  rawPhone: string,
): GuestReputation | null {
  const phoneKey = formatPhone(rawPhone);
  if (!phoneKey) return null;

  let totalCount = 0;
  let cancelledCount = 0;
  let name = "";
  let lastVisit = new Date(0);

  for (const b of bookings) {
    const bPhone = formatPhone(String(b.phone || ""));
    if (!bPhone || bPhone !== phoneKey) continue;
    totalCount++;
    if (String(b.status || "").toLowerCase().includes("скас")) cancelledCount++;
    const checkIn = parseSafeDate(b.checkIn);
    if (!isNaN(checkIn.getTime()) && checkIn > lastVisit) {
      lastVisit = checkIn;
      const n = String(b.name || "").replace(" (Ручна бронь)", "").trim();
      if (n) name = n;
    }
  }

  if (totalCount === 0) return null;
  return {
    phone: phoneKey,
    name,
    totalCount,
    activeCount: totalCount - cancelledCount,
    cancelledCount,
    lastVisit,
  };
}

export type GuestReputationTier = "new" | "regular" | "vip" | "risky";

export function getGuestReputationTier(rep: GuestReputation | null): GuestReputationTier {
  if (!rep || rep.totalCount <= 1) return "new";
  const cancelRatio = rep.cancelledCount / rep.totalCount;
  if (rep.cancelledCount >= 2 && cancelRatio >= 0.5) return "risky";
  if (rep.activeCount >= 4) return "vip";
  if (rep.activeCount >= 2) return "regular";
  return "new";
}

export const GUEST_REPUTATION_EMOJI: Record<GuestReputationTier, string> = {
  new: "",
  regular: "🙂",
  vip: "⭐",
  risky: "⚠️",
};

export const GUEST_REPUTATION_LABEL: Record<GuestReputationTier, string> = {
  new: "",
  regular: "Постійний гість",
  vip: "VIP гість — часто бронює",
  risky: "Часто скасовує бронювання",
};
