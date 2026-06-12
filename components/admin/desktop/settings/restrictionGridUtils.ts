import { formatDateKey } from "../bookingUtils";
import type { AdminSettingsPayload } from "../types";

export type RestrictionSelection = {
  roomId: string;
  dates: string[];
  minN?: number;
  highlightCells?: boolean;
} | null;

export function getRestrictionMinNights(
  restrictions: AdminSettingsPayload["restrictions"],
  roomId: number | string,
  dateObj: Date
): number {
  const ds = formatDateKey(dateObj);
  const room = restrictions?.[String(roomId)];
  if (room && room[ds]) return room[ds];
  return 0;
}

export function isPriceWeekend(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 5 || dow === 6;
}

export function getRestrictionCellSelectionClasses(
  selection: RestrictionSelection,
  roomId: number | string,
  dateStr: string
): string {
  if (!selection?.highlightCells || !selection.dates?.length) return "";
  if (String(selection.roomId) !== String(roomId)) return "";
  if (!selection.dates.includes(dateStr)) return "";
  const sorted = [...selection.dates].sort();
  let cls = "cell-selected";
  if (dateStr === sorted[0]) cls += " cell-selected-start";
  if (dateStr === sorted[sorted.length - 1]) cls += " cell-selected-end";
  return cls;
}

export function isSameRestrictionSelection(
  selection: RestrictionSelection,
  roomId: string,
  dates: string[]
): boolean {
  if (!selection?.highlightCells) return false;
  if (String(selection.roomId) !== String(roomId)) return false;
  const a = [...dates].sort();
  const b = [...(selection.dates || [])].sort();
  if (a.length !== b.length) return false;
  return a.every((d, i) => d === b[i]);
}

export type RestrictionSegment = {
  startIndex: number;
  length: number;
  minN: number;
  startDateStr: string;
  dates: string[];
};

export function getRestrictionSegmentsForRoom(
  restrictions: AdminSettingsPayload["restrictions"],
  roomId: number | string,
  startDate: Date,
  daysCount: number
): RestrictionSegment[] {
  const segments: RestrictionSegment[] = [];
  let i = 0;
  while (i < daysCount) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const minN = getRestrictionMinNights(restrictions, roomId, d);
    if (minN <= 0) {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < daysCount) {
      const dNext = new Date(startDate);
      dNext.setDate(startDate.getDate() + j);
      if (getRestrictionMinNights(restrictions, roomId, dNext) !== minN) break;
      j++;
    }
    const dates: string[] = [];
    for (let k = i; k < j; k++) {
      const dk = new Date(startDate);
      dk.setDate(startDate.getDate() + k);
      dates.push(formatDateKey(dk));
    }
    segments.push({
      startIndex: i,
      length: j - i,
      minN,
      startDateStr: formatDateKey(d),
      dates,
    });
    i = j;
  }
  return segments;
}
