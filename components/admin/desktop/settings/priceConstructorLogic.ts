import { formatDateKey } from "../bookingUtils";
import type { AdminSettingsPayload } from "../types";
import type { PriceFormState } from "./GenericModalContent";
import { parsePriceInput } from "./priceGridUtils";

export const ALL_WEEKDAY_INDICES = [1, 2, 3, 4, 5, 6, 0] as const;

export type PriceConstructorPreset = {
  roomId?: string;
  roomIds?: string[];
  allRoomsActive?: boolean;
  date?: string;
  startDate?: string;
  endDate?: string;
  weekdays?: number[];
  selectionDateStrs?: string[];
};

export function weekdaysFromDateStrings(dateStrs: string[]): number[] {
  const set = new Set<number>();
  for (const ds of dateStrs) {
    const d = new Date(`${ds.substring(0, 10)}T12:00:00`);
    if (!isNaN(d.getTime())) set.add(d.getDay());
  }
  return Array.from(set).sort((a, b) => a - b);
}

export function buildGridSelectionPreset(
  roomIds: string[],
  dateStrs: string[],
  totalActiveRooms: number
): PriceConstructorPreset {
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

export function buildPriceForm(baseDate?: Date, preset?: PriceConstructorPreset): PriceFormState {
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
    selectedRoomIds,
    allRoomsActive: Boolean(preset?.allRoomsActive),
    amount: "",
    startDate,
    endDate,
    selectedWeekdays: preset?.weekdays ? [...preset.weekdays] : [],
    selectionDateStrs: preset?.selectionDateStrs ? [...preset.selectionDateStrs] : null,
  };
}

export function applyPriceFormToSettings(
  settings: AdminSettingsPayload,
  form: PriceFormState
): AdminSettingsPayload | null {
  const selectedRooms = form.allRoomsActive
    ? (settings.roomsList || []).map((r) => String(r.id))
    : form.selectedRoomIds;
  const amount = parsePriceInput(form.amount);

  if (amount <= 0) return null;
  if (selectedRooms.length === 0) return null;
  if (form.selectedWeekdays.length === 0 && !form.selectionDateStrs?.length) return null;
  if (!form.startDate || !form.endDate) return null;

  const start = new Date(`${form.startDate.substring(0, 10)}T12:00:00`);
  const end = new Date(`${form.endDate.substring(0, 10)}T12:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;

  const customPrices = { ...(settings.customPrices || {}) };
  const startIso = form.startDate.substring(0, 10);
  const endIso = form.endDate.substring(0, 10);

  const applyDate = (dateStr: string) => {
    if (dateStr < startIso || dateStr > endIso) return;
    const d = new Date(`${dateStr}T12:00:00`);
    if (isNaN(d.getTime())) return;
    if (!form.selectedWeekdays.includes(d.getDay())) return;
    for (const rid of selectedRooms) {
      if (!customPrices[rid]) customPrices[rid] = {};
      customPrices[rid][dateStr] = amount;
    }
  };

  if (form.selectionDateStrs?.length) {
    for (const dateStr of form.selectionDateStrs) {
      const iso = dateStr.substring(0, 10);
      for (const rid of selectedRooms) {
        if (!customPrices[rid]) customPrices[rid] = {};
        customPrices[rid][iso] = amount;
      }
    }
  } else {
    const d = new Date(start);
    while (d <= end) {
      applyDate(formatDateKey(d));
      d.setDate(d.getDate() + 1);
    }
  }

  return { ...settings, customPrices };
}

export function patchSingleCustomPrice(
  settings: AdminSettingsPayload,
  roomId: number | string,
  dateStr: string,
  amount: number
): AdminSettingsPayload {
  const rid = String(roomId);
  const customPrices = { ...(settings.customPrices || {}) };
  if (!customPrices[rid]) customPrices[rid] = {};
  customPrices[rid][dateStr] = amount;
  return { ...settings, customPrices };
}
