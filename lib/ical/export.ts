import { ICAL_SOURCE, ICAL_UID_COMMENT_PREFIX, ICAL_UID_SUFFIX } from "./types";

export type IcalExportBooking = {
  id?: string | number;
  roomId?: number | string | null;
  cottage?: string;
  checkIn?: string;
  checkOut?: string;
  status?: string;
  source?: string;
  comment?: string;
  assignmentState?: string;
  name?: string;
};

function formatDateIcal(isoDate: string): string | null {
  const m = String(isoDate || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3]}`;
}

function isCancelledStatus(status: string | undefined): boolean {
  return String(status || "")
    .toLowerCase()
    .includes("скас");
}

function isImportedIcalBlock(booking: IcalExportBooking): boolean {
  const comment = String(booking.comment || "");
  if (comment.includes(ICAL_UID_COMMENT_PREFIX)) return true;
  const source = String(booking.source || "").toLowerCase();
  const id = String(booking.id || "");
  return source.includes("booking") && id.startsWith("ICAL-");
}

function roomMatches(
  booking: IcalExportBooking,
  roomId: number | string,
  roomLabels: string[]
): boolean {
  if (booking.assignmentState === "holding") return false;
  if (booking.roomId != null && booking.roomId !== "" && String(booking.roomId) === String(roomId)) {
    return true;
  }
  const cottage = String(booking.cottage || "").trim().toLowerCase();
  if (!cottage) return false;
  return roomLabels.some((label) => label && cottage === label.toLowerCase());
}

/** Стабільний UID для експорту наших броней (щоб Booking не дублював). */
export function buildExportEventUid(bookingId: string | number, roomId: number | string): string {
  const clean = String(bookingId || "x")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 48);
  return `${clean}-r${roomId}${ICAL_UID_SUFFIX}`;
}

export function generateIcalFeed(params: {
  roomId: number | string;
  roomName: string;
  roomLabels?: string[];
  bookings: IcalExportBooking[];
  calendarName?: string;
}): string {
  const { roomId, roomName, bookings } = params;
  const roomLabels = params.roomLabels || [];
  const calName = params.calendarName || roomName;
  const now = new Date();
  const stamp =
    `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}` +
    `T${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}Z`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Khata / Azhunebi//UK",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcalText(calName)}`,
  ];

  for (const booking of bookings) {
    if (isCancelledStatus(booking.status)) continue;
    if (!roomMatches(booking, roomId, roomLabels)) continue;
    // Не експортуємо блоки, які самі прийшли з Booking — інакше петля.
    if (isImportedIcalBlock(booking)) continue;

    const dtStart = formatDateIcal(String(booking.checkIn || ""));
    const dtEnd = formatDateIcal(String(booking.checkOut || ""));
    if (!dtStart || !dtEnd) continue;

    const uid = buildExportEventUid(booking.id || `${dtStart}-${dtEnd}`, roomId);
    const summary =
      String(booking.source || "").toLowerCase() === ICAL_SOURCE.toLowerCase()
        ? `Бронь ${roomName}`
        : `Зайнято · ${roomName}`;

    lines.push(
      "BEGIN:VEVENT",
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `SUMMARY:${escapeIcalText(summary)}`,
      "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function escapeIcalText(value: string): string {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
