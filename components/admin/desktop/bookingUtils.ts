import { formatPhone, parseSafeDate } from "./adminDates";
import { showToast } from "./adminGlobals";
import {
  findRoomForBooking as findRoomForBookingCore,
  normalizeRoomLabel as normalizeRoomLabelCore,
} from "@/lib/admin/roomBookingMatch";
import type { SpecialTariffToggle, YesNo } from "@/lib/admin/specialTariffBooking";
import {
  defaultSpecialTariffState,
  parseSpecialTariffState,
  stripSpecialTariffTokensFromComment,
} from "@/lib/admin/specialTariffBooking";
import type { BookingRecord, RoomConfig } from "./types";

export function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isHutshubBooking(b: BookingRecord): boolean {
  return String((b && b.source) || "")
    .toLowerCase()
    .includes("hutshub");
}

/** @see lib/admin/roomBookingMatch */
export const normalizeRoomLabel = normalizeRoomLabelCore;

/** Підпис у селекті котеджу — без порожніх «()». */
export function formatRoomDisplayLabel(name: string, desc?: string | null): string {
  const cleanName = String(name || "")
    .replace(/\s*\(\s*\)\s*$/, "")
    .trim();
  const trimmed = String(desc || "").trim();
  return trimmed ? `${cleanName} (${trimmed})` : cleanName;
}

/** Знайти рядок шахматки для броні — roomId має пріоритет над назвою cottage */
export function findRoomForBooking(
  booking: BookingRecord,
  rooms: RoomConfig[]
): RoomConfig | null {
  return findRoomForBookingCore(booking, rooms) as RoomConfig | null;
}

/** Синтетичний рядок для броней без відповідного житла в налаштуваннях */
export function createOrphanTimelineRoom(cottageName: string, index: number): RoomConfig {
  const label = String(cottageName || "Без котеджу").trim() || "Без котеджу";
  return {
    id: -(index + 1),
    name: label,
    short: label,
    desc: "Немає в налаштуваннях",
    capacity: 0,
    priceWeekday: 0,
    priceWeekend: 0,
    active: true,
  };
}

/** Прив’язка броні до рядка шахматки */
export function bookingMatchesRoom(booking: BookingRecord, room: RoomConfig): boolean {
  return findRoomForBooking(booking, [room])?.id === room.id;
}

export function getBookingBadgeClass(booking: BookingRecord): string {
  const s = String(booking.status).toLowerCase();
  const src = String(booking.source || "").toLowerCase();
  if (s.includes("скас")) return "cancelled";
  if (src.includes("hutshub")) return "hutshub";
  if (s.includes("підтвердж")) return "confirmed";
  return "new";
}

/** Сума на картці шахматки в кольоровому бейджі (без підписів «Борг», «Оплачено» тощо). */
export function getTimelineFinBadge(
  booking: BookingRecord
): { text: string; bg: string; color: string } {
  const statusClass = getTimelineStatusClass(booking);
  const total = Number(booking.totalPrice) || 0;
  const paid = Number(booking.paidAmount) || 0;
  const balance = total - paid;

  if (statusClass === "status-cancelled") {
    return { text: "—", bg: "rgba(0,0,0,0.05)", color: "#9CA3AF" };
  }
  if (statusClass === "status-hutshub") {
    return { text: total > 0 ? `${Math.round(total)} грн` : "—", bg: "rgba(255,255,255,0.3)", color: "#1A332A" };
  }
  if (total === 0) {
    return { text: "—", bg: "rgba(255,255,255,0.3)", color: "#4B5563" };
  }
  if (paid === 0) {
    const prepay = Math.round(Number(booking.prepayAmount) || 0);
    const advanceAmount = prepay > 0 ? prepay : Math.round(total / 2);
    return { text: `${advanceAmount} грн`, bg: "#F59E0B", color: "#FFFFFF" };
  }
  if (balance <= 0) {
    return { text: `${Math.round(total)} грн`, bg: "#10B981", color: "#FFFFFF" };
  }
  return { text: `${Math.round(balance)} грн`, bg: "#EF4444", color: "#FFFFFF" };
}

/** Міні-напис у кутку картки (2+ ночі): «2» або «2+1» за денними гостями. */
export function formatTimelineGuestChip(booking: BookingRecord): string {
  const guests = Math.max(1, Number(booking.guests) || 2);
  const { dayGuests } = parseBookingComment(String(booking.comment || ""));
  if (dayGuests > 0) return `${guests}+${dayGuests}`;
  return String(guests);
}

/** Компактний текст суми для вузьких карток (1 ніч). */
export function formatTimelineFinText(
  finBadge: { text: string },
  contentWidth: number
): string {
  if (finBadge.text === "—") return finBadge.text;
  const amount = finBadge.text.replace(/\s*грн\s*$/i, "").trim();
  if (contentWidth < 46) return amount;
  return finBadge.text;
}

export function getTimelineStatusClass(booking: BookingRecord): string {
  const sClass = String(booking.status).toLowerCase();
  if (sClass.includes("скас")) return "status-cancelled";
  if (
    String(booking.source || "")
      .toLowerCase()
      .includes("hutshub") ||
    String(booking.name || "")
      .toLowerCase()
      .includes("hutshub")
  ) {
    return "status-hutshub";
  }
  const total = Number(booking.totalPrice) || 0;
  const paid = Number(booking.paidAmount) || 0;
  if (total > 0 && total - paid <= 0) return "status-confirmed";
  return "status-new";
}

export function bookingHasEarlyLate(comment: string): { hasEarly: boolean; hasLate: boolean } {
  const exComment = comment || "";
  let hasEarly = exComment.includes("Ранній заїзд");
  let hasLate = exComment.includes("Пізній виїзд");
  return { hasEarly, hasLate };
}

export function sortBookingsByCheckIn(bookings: BookingRecord[]): BookingRecord[] {
  return [...bookings].sort((a, b) => {
    const ta = parseSafeDate(a.checkIn).getTime();
    const tb = parseSafeDate(b.checkIn).getTime();
    if (isNaN(ta) && isNaN(tb)) return 0;
    if (isNaN(ta)) return 1;
    if (isNaN(tb)) return -1;
    return ta - tb;
  });
}

export function filterBookingsList(
  bookings: BookingRecord[],
  filterType: "all" | "future" | "cancelled"
): BookingRecord[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (filterType === "future") {
    return bookings.filter((b) => {
      const d = parseSafeDate(b.checkIn);
      return !isNaN(d.getTime()) && d >= today && !String(b.status).toLowerCase().includes("скас");
    });
  }
  if (filterType === "cancelled") {
    return bookings.filter((b) => String(b.status).toLowerCase().includes("скас"));
  }
  return bookings;
}

export async function copyToClipboard(text: string, e?: React.MouseEvent): Promise<void> {
  e?.stopPropagation();
  try {
    await navigator.clipboard.writeText(text);
    showToast("Скопійовано!");
  } catch {
    showToast("Не вдалося скопіювати");
  }
}

export function displayClientName(name: string): string {
  return String(name).replace(" (Ручна бронь)", "");
}

/** Єдиний + на початку, незалежно від того, чи в БД вже є «+» */
export function displayPhone(phone: string): string {
  const digits = formatPhone(String(phone || "").replace(/^\+/, ""));
  return digits ? `+${digits}` : "";
}

export interface ParsedBookingComment {
  guestComment: string;
  dayGuests: number;
  vat: "Так" | "Ні";
  specialTariffs: Record<string, YesNo>;
  earlyTime: string | null;
  lateTime: string | null;
}

export function parseBookingComment(
  raw: string,
  specialTariffToggles: SpecialTariffToggle[] = []
): ParsedBookingComment {
  let textComment = raw || "";
  let parsedDayGuests = 0;

  const matchDay = textComment.match(/👥 Денні гості[^:]*:\s*(\d+)/);
  if (matchDay) {
    parsedDayGuests = parseInt(matchDay[1], 10);
    textComment = textComment.replace(/👥 Денні гості[^|]+(\|\s*)?/, "").trim();
  }

  let vat: "Так" | "Ні" = "Ні";
  if (textComment.includes("♨️ Чан: Так")) {
    vat = "Так";
    textComment = textComment.replace(/♨️ Чан: Так\s*(\|\s*)?/, "").trim();
  }

  const specialTariffs =
    specialTariffToggles.length > 0
      ? parseSpecialTariffState(textComment, specialTariffToggles)
      : defaultSpecialTariffState([]);
  textComment = stripSpecialTariffTokensFromComment(textComment, specialTariffToggles);

  let earlyTime: string | null = null;
  const matchEarly = textComment.match(/🕒 Ранній заїзд: з (\d{2}:\d{2})(\s*\|\s*)?/);
  if (matchEarly) {
    earlyTime = matchEarly[1];
    textComment = textComment.replace(matchEarly[0], "").trim();
  }

  let lateTime: string | null = null;
  const matchLate = textComment.match(/🕒 Пізній виїзд: до (\d{2}:\d{2})(\s*\|\s*)?/);
  if (matchLate) {
    lateTime = matchLate[1];
    textComment = textComment.replace(matchLate[0], "").trim();
  }

  textComment = textComment
    .replace(/^Коментар гостя:\s*/, "")
    .replace(/^\|\s*/, "")
    .replace(/\|\s*$/, "")
    .trim();

  return {
    guestComment: textComment,
    dayGuests: parsedDayGuests,
    vat,
    specialTariffs,
    earlyTime,
    lateTime,
  };
}
