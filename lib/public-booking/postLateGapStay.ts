import type { BookedRange } from "./types";

/** First night discount when check-in falls on previous guest's late-checkout day. */
export const POST_LATE_GAP_FIRST_NIGHT_DISCOUNT = 0.5;

export function timeToMinutes(time: string): number {
  const m = String(time || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function minutesToTime(totalMinutes: number): string {
  const mins = Math.max(0, Math.min(23 * 60 + 30, Math.round(totalMinutes)));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Arrival slot after previous guest's late checkout (default +30 min). */
export function arrivalAfterLateCheckout(lateTime: string | null | undefined): string {
  const late = lateTime && /^\d{1,2}:\d{2}$/.test(lateTime.trim()) ? lateTime.trim() : "20:00";
  return minutesToTime(timeToMinutes(late) + 30);
}

export function findPrevLateCheckoutRange(
  checkIn: Date,
  ranges: BookedRange[]
): BookedRange | null {
  const day = new Date(checkIn);
  day.setHours(0, 0, 0, 0);
  const t = day.getTime();
  return ranges.find((r) => r.end.getTime() === t && r.hasLate) || null;
}

export function isPostLateGapStay(
  checkIn: Date,
  ranges: BookedRange[]
): boolean {
  return Boolean(findPrevLateCheckoutRange(checkIn, ranges));
}

export function buildPostLateGapNoticeHtml(prevLateTime: string, arrivalTime: string): string {
  return (
    `Попередній гість виїжджає о <b>${prevLateTime}</b>. ` +
    `Заїзд можливий лише <b>після ${arrivalTime}</b>, виїзд — за стандартом. ` +
    `За ці умови діє знижка <b>−50%</b> на першу ніч.`
  );
}

export function buildPostLateCommentToken(time: string): string {
  return `🕒#postlate⏳: ${time}`;
}

export function parsePostLateArrivalFromComment(raw: string): string | null {
  return (
    raw.match(/🕒#postlate⏳:\s*(\d{2}:\d{2})/)?.[1] ||
    raw.match(/🕒\s*Заїзд після пізнього виїзду:\s*з\s*(\d{2}:\d{2})/)?.[1] ||
    null
  );
}
