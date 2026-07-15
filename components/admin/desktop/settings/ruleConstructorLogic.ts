import { formatDateKey } from "../bookingUtils";
import type { AdminSettingsPayload } from "../types";
import { CLOSED_DATE_SENTINEL } from "./restrictionGridUtils";
import { ALL_WEEKDAY_INDICES } from "./priceConstructorLogic";

export type RuleActionType = "minNights" | "closed";

export type RuleFormState = {
  action: RuleActionType;
  minNights: number;
  selectedRoomIds: string[];
  allRoomsActive: boolean;
  startDate: string;
  endDate: string;
  selectedWeekdays: number[];
  selectionDateStrs: string[] | null;
};

export type RuleConstructorPreset = {
  roomId?: string;
  roomIds?: string[];
  allRoomsActive?: boolean;
  date?: string;
  startDate?: string;
  endDate?: string;
  weekdays?: number[];
  selectionDateStrs?: string[];
  action?: RuleActionType;
  minNights?: number;
};

export { ALL_WEEKDAY_INDICES };

export function weekdaysFromDateStrings(dateStrs: string[]): number[] {
  const set = new Set<number>();
  for (const ds of dateStrs) {
    const d = new Date(`${ds.substring(0, 10)}T12:00:00`);
    if (!isNaN(d.getTime())) set.add(d.getDay());
  }
  return Array.from(set).sort((a, b) => a - b);
}

export function buildRuleGridSelectionPreset(
  roomIds: string[],
  dateStrs: string[],
  totalActiveRooms: number
): RuleConstructorPreset {
  const sortedDates = [...dateStrs].sort();
  return {
    roomIds: roomIds.map(String),
    allRoomsActive: roomIds.length > 0 && roomIds.length === totalActiveRooms,
    startDate: sortedDates[0],
    endDate: sortedDates[sortedDates.length - 1],
    weekdays: weekdaysFromDateStrings(sortedDates),
    selectionDateStrs: sortedDates,
  };
}

export function buildRuleForm(baseDate?: Date, preset?: RuleConstructorPreset): RuleFormState {
  const base = baseDate ? new Date(baseDate) : new Date();
  base.setDate(1);
  base.setHours(0, 0, 0, 0);
  const monthEnd = new Date(base.getFullYear(), base.getMonth() + 1, 0);

  const startDate =
    preset?.startDate?.substring(0, 10) ||
    preset?.date?.substring(0, 10) ||
    formatDateKey(base);
  const endDate =
    preset?.endDate?.substring(0, 10) ||
    preset?.date?.substring(0, 10) ||
    formatDateKey(monthEnd);

  const selectedRoomIds = preset?.roomIds?.length
    ? preset.roomIds.map(String)
    : preset?.roomId
      ? [String(preset.roomId)]
      : [];

  return {
    action: preset?.action || "minNights",
    minNights: preset?.minNights && preset.minNights > 0 ? preset.minNights : 2,
    selectedRoomIds,
    allRoomsActive: Boolean(preset?.allRoomsActive),
    startDate,
    endDate,
    selectedWeekdays: preset?.weekdays ? [...preset.weekdays] : [],
    selectionDateStrs: preset?.selectionDateStrs ? [...preset.selectionDateStrs] : null,
  };
}

function applyDateToRooms(
  settings: AdminSettingsPayload,
  roomIds: string[],
  dateStr: string,
  action: RuleActionType,
  minNights: number
) {
  const restrictions = { ...(settings.restrictions || {}) };
  const closedDates = { ...(settings.closedDates || {}) };

  for (const rid of roomIds) {
    if (action === "closed") {
      if (!closedDates[rid]) closedDates[rid] = {};
      closedDates[rid][dateStr] = true;
      if (!restrictions[rid]) restrictions[rid] = {};
      restrictions[rid][dateStr] = CLOSED_DATE_SENTINEL;
    } else {
      if (!restrictions[rid]) restrictions[rid] = {};
      restrictions[rid][dateStr] = minNights;
      if (closedDates[rid]) {
        delete closedDates[rid][dateStr];
        if (Object.keys(closedDates[rid]).length === 0) delete closedDates[rid];
      }
    }
  }

  return { restrictions, closedDates };
}

export function applyRuleFormToSettings(
  settings: AdminSettingsPayload,
  form: RuleFormState
): AdminSettingsPayload | null {
  const selectedRooms = form.allRoomsActive
    ? (settings.roomsList || []).filter((r) => r.active).map((r) => String(r.id))
    : form.selectedRoomIds;

  if (selectedRooms.length === 0) return null;
  if (form.selectedWeekdays.length === 0 && !form.selectionDateStrs?.length) return null;
  if (!form.startDate || !form.endDate) return null;

  if (form.action === "minNights" && (form.minNights < 1 || !Number.isFinite(form.minNights))) {
    return null;
  }

  const start = new Date(`${form.startDate.substring(0, 10)}T12:00:00`);
  const end = new Date(`${form.endDate.substring(0, 10)}T12:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;

  let next = { ...settings };
  const startIso = form.startDate.substring(0, 10);
  const endIso = form.endDate.substring(0, 10);

  const applyDate = (dateStr: string) => {
    if (dateStr < startIso || dateStr > endIso) return;
    const d = new Date(`${dateStr}T12:00:00`);
    if (isNaN(d.getTime())) return;
    if (!form.selectedWeekdays.includes(d.getDay())) return;
    const patched = applyDateToRooms(next, selectedRooms, dateStr, form.action, form.minNights);
    next = { ...next, ...patched };
  };

  if (form.selectionDateStrs?.length) {
    for (const dateStr of form.selectionDateStrs) {
      const iso = dateStr.substring(0, 10);
      const patched = applyDateToRooms(next, selectedRooms, iso, form.action, form.minNights);
      next = { ...next, ...patched };
    }
  } else {
    const d = new Date(start);
    while (d <= end) {
      applyDate(formatDateKey(d));
      d.setDate(d.getDate() + 1);
    }
  }

  return next;
}

export const RULE_SETTINGS_KEYS = ["restrictions", "closedDates"] as const;
