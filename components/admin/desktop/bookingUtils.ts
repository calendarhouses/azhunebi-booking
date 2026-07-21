import { formatPhone, parseSafeDate } from "./adminDates";
import { showToast } from "./adminGlobals";
import {
  findRoomForBooking as findRoomForBookingCore,
  normalizeRoomLabel as normalizeRoomLabelCore,
  type BookingLike,
} from "@/lib/admin/roomBookingMatch";
import type { SpecialTariffToggle, YesNo } from "@/lib/admin/specialTariffBooking";
import {
  defaultSpecialTariffState,
  parseSpecialTariffState,
  stripSpecialTariffTokensFromComment,
} from "@/lib/admin/specialTariffBooking";
import type { BookingRecord, RoomConfig } from "./types";
import {
  buildPromoCodeCommentToken,
  parsePromoCodeFromComment,
  stripPromoCodeFromComment,
} from "@/lib/admin/bookingDiscountCalc";
import {
  isAwaitingPaymentStatus,
  isPendingReviewStatus,
} from "@/lib/public-booking/bookingReview";
import {
  paidUntilDate,
  resolveBookingFinanceSummary,
} from "@/lib/admin/bookingPayments";
import {
  parseEarlyLateTimesFromComment,
  stripFlexibleTokensFromComment,
} from "@/lib/admin/flexibleSchedule";
import {
  BOOKING_STATUS_ACCENT,
  bookingColorForeground,
  normalizeBookingCustomColor,
} from "@/lib/bookingCustomColor";
import type { CSSProperties } from "react";
import {
  parseChildrenFromComment,
  parseSelectedServicesFromComment,
  parseYoungestChildAgeFromComment,
  stripChildrenFromComment,
  stripServiceTokensFromComment,
  type ServiceSelectionMap,
} from "./settings/additionalServicesLogic";

export function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isHutshubBooking(b: BookingRecord): boolean {
  return String((b && b.source) || "")
    .toLowerCase()
    .includes("hutshub");
}

export function findBookingInList(
  bookings: BookingRecord[],
  key: string | number | null | undefined
): BookingRecord | undefined {
  if (key == null || key === "") return undefined;
  const normalized = String(key);
  return (
    bookings.find((b) => String(b.id) === normalized) ??
    bookings.find((b) => String(b.row) === normalized)
  );
}

export function resolveBookingOrderId(
  booking?: BookingRecord | null,
  fallbackTitle?: string
): string {
  const fromBooking = String(booking?.id || "").trim();
  if (fromBooking) return fromBooking;
  const fromTitle = String(fallbackTitle || "").match(/B-\d+/)?.[0];
  return fromTitle || "";
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
  booking: BookingLike,
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
export function bookingMatchesRoom(booking: BookingLike, room: RoomConfig): boolean {
  return findRoomForBooking(booking, [room])?.id === room.id;
}

export function getBookingBadgeClass(booking: BookingRecord): string {
  const s = String(booking.status).toLowerCase();
  const src = String(booking.source || "").toLowerCase();
  if (s.includes("скас")) return "cancelled";
  if (src.includes("hutshub")) return "hutshub";
  if (isPendingReviewStatus(booking.status)) return "pending-review";
  if (isAwaitingPaymentStatus(booking.status)) return "new";
  if (s.includes("підтвердж")) return "confirmed";
  return "new";
}

/** Сума на картці шахматки: жовтий «очікує», зелений «оплачено», червоний «борг». */
export function getTimelineFinBadge(
  booking: BookingRecord
): { text: string; bg: string; color: string } {
  const statusClass = getTimelineStatusClass(booking);
  const { total, paid, balance, prepayExpected } = resolveBookingFinanceSummary(booking);

  if (statusClass === "status-cancelled") {
    return { text: "—", bg: "rgba(0,0,0,0.05)", color: "#9CA3AF" };
  }
  if (statusClass === "status-hutshub") {
    return { text: total > 0 ? `${Math.round(total)} грн` : "—", bg: "rgba(255,255,255,0.3)", color: "#1A332A" };
  }
  if (statusClass === "status-pending-review") {
    const prepay = prepayExpected > 0 ? prepayExpected : Math.round(total / 2);
    return { text: prepay > 0 ? `${prepay} грн` : "—", bg: "#F59E0B", color: "#78350F" };
  }
  if (total === 0) {
    return { text: "—", bg: "rgba(255,255,255,0.3)", color: "#4B5563" };
  }
  if (paid === 0) {
    const advanceAmount = prepayExpected > 0 ? prepayExpected : Math.round(total / 2);
    return { text: `${advanceAmount} грн`, bg: "#F59E0B", color: "#78350F" };
  }
  if (balance <= 0) {
    return { text: `${Math.round(total)} грн`, bg: "#16A34A", color: "#FFFFFF" };
  }
  return { text: `${Math.round(balance)} грн`, bg: "#EF4444", color: "#FFFFFF" };
}

export type TimelineOneNightFinKind = "pending" | "debt" | "paid" | "neutral";

/** Статус оплати для мікрокарток (1 ніч): іконка замість суми. */
export function getTimelineOneNightFinKind(booking: BookingRecord): TimelineOneNightFinKind {
  const statusClass = getTimelineStatusClass(booking);
  const { total, paid, balance } = resolveBookingFinanceSummary(booking);

  if (statusClass === "status-cancelled" || total === 0) return "neutral";
  if (statusClass === "status-pending-review") return "pending";
  if (paid === 0) return "pending";
  if (balance <= 0) return "paid";
  return "debt";
}

export function getTimelineOneNightFinAriaLabel(kind: TimelineOneNightFinKind): string {
  if (kind === "pending") return "Очікує підтвердження або оплату";
  if (kind === "debt") return "Борг";
  if (kind === "paid") return "Оплачено повністю";
  return "Без суми";
}

/** Міні-напис у кутку картки: «2», «2+1» (дорослі+діти) або «2+1» з денними гостями. */
export function formatTimelineGuestChip(booking: BookingRecord): string {
  const adults = Math.max(1, Number(booking.guests) || 2);
  const { children, dayGuests } = parseBookingComment(String(booking.comment || ""));
  if (children > 0) return `${adults}+${children}`;
  if (dayGuests > 0) return `${adults}+${dayGuests}`;
  return String(adults);
}

/** Компактний текст суми для вузьких карток. */
export function formatTimelineFinText(
  finBadge: { text: string },
  contentWidth: number
): string {
  if (finBadge.text === "—") return finBadge.text;
  const amount = finBadge.text.replace(/\s*грн\s*$/i, "").trim();
  if (contentWidth < 46) return amount;
  return finBadge.text;
}

/**
 * Ієрархія кольору картки:
 * 1) custom_color → status-custom (+ inline style)
 * 2) Оплачено повністю → status-paid (зелений)
 * 3) Підтверджено → status-confirmed (блакитний)
 * 4) Очікує оплату / Нова бронь → status-new (синій)
 * Інакше — legacy (скасовано / review / hutshub).
 */
export function getTimelineStatusClass(booking: BookingRecord): string {
  if (normalizeBookingCustomColor(booking.custom_color)) return "status-custom";

  const status = String(booking.status || "");
  const sClass = status.toLowerCase();
  if (sClass.includes("скас")) return "status-cancelled";
  if (isPendingReviewStatus(booking.status)) return "status-pending-review";

  const { total, balance } = resolveBookingFinanceSummary(booking);
  if (total > 0 && balance <= 0) return "status-paid";

  if (status === "Підтверджено") return "status-confirmed";
  if (status === "Очікує оплату" || status === "Нова бронь" || isAwaitingPaymentStatus(booking.status)) {
    return "status-new";
  }

  if (isHutshubBooking(booking)) return "status-hutshub";

  return "status-new";
}

/** Акцентний колір для drawer/modal (custom → оплата → статус). */
export function resolveBookingAccentColor(
  booking: BookingRecord | null | undefined,
  overrides?: { customColor?: string | null; status?: string }
): string {
  const custom = normalizeBookingCustomColor(
    overrides?.customColor ?? booking?.custom_color
  );
  if (custom) return custom;

  const status = String(overrides?.status ?? booking?.status ?? "");
  const sClass = status.toLowerCase();
  if (sClass.includes("скас")) return BOOKING_STATUS_ACCENT.cancelled;
  if (isPendingReviewStatus(status)) return BOOKING_STATUS_ACCENT.pendingReview;

  if (booking) {
    const { total, balance } = resolveBookingFinanceSummary(booking);
    if (total > 0 && balance <= 0) return BOOKING_STATUS_ACCENT.paid;
  }

  if (status === "Підтверджено") return BOOKING_STATUS_ACCENT.confirmed;
  if (status === "Очікує оплату" || status === "Нова бронь" || isAwaitingPaymentStatus(status)) {
    return BOOKING_STATUS_ACCENT.new;
  }

  if (booking && isHutshubBooking(booking)) return BOOKING_STATUS_ACCENT.hutshub;

  return BOOKING_STATUS_ACCENT.default;
}

/** Inline стилі картки на шахматці: фон для custom_color + контрастний колір імені. */
export function getTimelineBookingBlockStyle(booking: BookingRecord): CSSProperties {
  const color = normalizeBookingCustomColor(booking.custom_color);
  const fg = bookingColorForeground(color ?? resolveBookingAccentColor(booking));
  const depth = {
    boxShadow:
      "0 1px 2px rgba(15, 23, 42, 0.06), 0 6px 14px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.42)",
    border: "1px solid rgba(15, 23, 42, 0.06)",
  } as const;

  if (color) {
    return {
      background: color,
      backgroundImage: "none",
      color: fg,
      ["--booking-card-fg" as string]: fg,
      borderColor: "transparent",
      ...depth,
      transition: "background-color 0.2s ease-in-out, color 0.2s ease-in-out",
    };
  }

  return { ["--booking-card-fg" as string]: fg };
}

/** @deprecated Використовуйте getTimelineBookingBlockStyle */
export function getTimelineCustomColorStyle(
  booking: BookingRecord
): CSSProperties | undefined {
  const color = normalizeBookingCustomColor(booking.custom_color);
  if (!color) return undefined;
  return getTimelineBookingBlockStyle(booking);
}

export function bookingHasEarlyLate(comment: string): { hasEarly: boolean; hasLate: boolean } {
  const exComment = comment || "";
  const hasEarly =
    /🕒#early/.test(exComment) || exComment.includes("Ранній заїзд");
  const hasLate =
    /🕒#late/.test(exComment) || exComment.includes("Пізній виїзд");
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
  children: number;
  youngestChildAge: number | null;
  selectedServices: ServiceSelectionMap;
  dayGuests: number;
  vat: "Так" | "Ні";
  specialTariffs: Record<string, YesNo>;
  promoCode: string;
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

  const promoCode = parsePromoCodeFromComment(raw || "");
  textComment = stripPromoCodeFromComment(textComment);

  const { earlyTime, lateTime } = parseEarlyLateTimesFromComment(raw || "");
  textComment = stripFlexibleTokensFromComment(textComment);

  const children = parseChildrenFromComment(raw || "");
  const youngestChildAge = parseYoungestChildAgeFromComment(raw || "");
  const selectedServices = parseSelectedServicesFromComment(raw || "");
  textComment = stripChildrenFromComment(textComment);
  textComment = stripServiceTokensFromComment(textComment);

  textComment = textComment
    .replace(/^Коментар гостя:\s*/, "")
    .replace(/^\|\s*/, "")
    .replace(/\|\s*$/, "")
    .trim();

  return {
    guestComment: textComment,
    children,
    youngestChildAge,
    selectedServices,
    dayGuests: parsedDayGuests,
    vat,
    specialTariffs,
    promoCode,
    earlyTime,
    lateTime,
  };
}

function bookingMergeKey(b: BookingRecord): string {
  return [
    String(b.checkIn || ""),
    String(b.checkOut || ""),
    String(b.cottage || ""),
    String(b.name || ""),
    String(b.phone || ""),
  ].join("|");
}

/** Зберігає локальні броні, які ще не встигли з’явитися на сервері після збереження. */
export function mergeBookingsWithPending(
  serverBookings: BookingRecord[],
  localBookings: BookingRecord[]
): BookingRecord[] {
  const serverById = new Map(serverBookings.map((b) => [String(b.id), b]));
  const serverKeys = new Set(serverBookings.map(bookingMergeKey));
  const serverRows = new Set(serverBookings.map((b) => String(b.row)));
  const merged = [...serverBookings];

  for (const local of localBookings) {
    const id = String(local.id || "");
    if (id.startsWith("__undo-pending-") && serverKeys.has(bookingMergeKey(local))) {
      continue;
    }
    if (id && serverById.has(id)) continue;
    if (serverKeys.has(bookingMergeKey(local))) continue;
    if (
      local.row != null &&
      serverRows.has(String(local.row)) &&
      (!id || !serverById.has(id))
    ) {
      continue;
    }
    merged.push(local);
  }

  return merged;
}
