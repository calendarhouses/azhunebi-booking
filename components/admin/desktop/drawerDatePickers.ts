"use client";

import { normalizeDateToIso } from "./adminDates";
import { createFlatpickr, Ukrainian, type FlatpickrInstance } from "./flatpickrAdmin";

/** Одне поле d.m.Y; ISO — у стані форми та при збереженні */
export const DRAWER_DATE_PICKER_OPTS = {
  locale: Ukrainian,
  dateFormat: "d.m.Y",
  disableMobile: true,
  allowInput: false,
  clickOpens: true,
  static: false,
} as const;

function isoToFlatpickrDate(iso: string): Date | undefined {
  const value = normalizeDateToIso(iso);
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function cleanupStaleDateInputs(inputId: string): void {
  const el = document.getElementById(inputId);
  const group = el?.closest(".form-group");
  if (!group) return;
  group.querySelectorAll("input").forEach((input) => {
    if (input.id !== inputId) input.remove();
  });
}

export function destroyDrawerDatePickers(
  checkIn: FlatpickrInstance | null,
  checkOut: FlatpickrInstance | null
): void {
  checkIn?.destroy();
  checkOut?.destroy();
  cleanupStaleDateInputs("adminCheckIn");
  cleanupStaleDateInputs("adminCheckOut");
}

export function initDrawerDatePickers(opts: {
  checkIn: string;
  checkOut: string;
  onCheckInChange: (iso: string) => void;
  onCheckOutChange: (iso: string) => void;
}): { checkIn: FlatpickrInstance; checkOut: FlatpickrInstance } | null {
  if (typeof document === "undefined") return null;

  const checkInEl = document.getElementById("adminCheckIn");
  const checkOutEl = document.getElementById("adminCheckOut");
  if (!checkInEl || !checkOutEl) return null;

  cleanupStaleDateInputs("adminCheckIn");
  cleanupStaleDateInputs("adminCheckOut");

  const existingIn = (checkInEl as HTMLElement & { _flatpickr?: FlatpickrInstance })._flatpickr;
  const existingOut = (checkOutEl as HTMLElement & { _flatpickr?: FlatpickrInstance })._flatpickr;
  existingIn?.destroy();
  existingOut?.destroy();

  const checkOutPicker = createFlatpickr(checkOutEl, {
    ...DRAWER_DATE_PICKER_OPTS,
    appendTo: document.body,
    defaultDate: isoToFlatpickrDate(opts.checkOut),
    onChange: (_selected, _dateStr, instance) => {
      opts.onCheckOutChange(normalizeDateToIso(instance.input.value));
    },
  });

  const checkInPicker = createFlatpickr(checkInEl, {
    ...DRAWER_DATE_PICKER_OPTS,
    appendTo: document.body,
    defaultDate: isoToFlatpickrDate(opts.checkIn),
    onChange: (_selected, _dateStr, instance) => {
      const iso = normalizeDateToIso(instance.input.value);
      opts.onCheckInChange(iso);
      if (iso) checkOutPicker.set("minDate", isoToFlatpickrDate(iso) ?? null);
    },
  });

  if (opts.checkIn) {
    const checkInDate = isoToFlatpickrDate(opts.checkIn);
    if (checkInDate) {
      checkInPicker.setDate(checkInDate, false);
      checkOutPicker.set("minDate", checkInDate);
    }
  }
  if (opts.checkOut) {
    const checkOutDate = isoToFlatpickrDate(opts.checkOut);
    if (checkOutDate) checkOutPicker.setDate(checkOutDate, false);
  }

  return { checkIn: checkInPicker, checkOut: checkOutPicker };
}

export function syncDrawerDatePickers(
  checkInPicker: FlatpickrInstance | null,
  checkOutPicker: FlatpickrInstance | null,
  checkIn: string,
  checkOut: string
): void {
  if (!checkInPicker || !checkOutPicker) return;
  if (checkIn) {
    const checkInDate = isoToFlatpickrDate(checkIn);
    if (checkInDate) {
      checkInPicker.setDate(checkInDate, false);
      checkOutPicker.set("minDate", checkInDate);
    }
  } else {
    checkInPicker.clear();
    checkOutPicker.set("minDate", null);
  }
  if (checkOut) {
    const checkOutDate = isoToFlatpickrDate(checkOut);
    if (checkOutDate) checkOutPicker.setDate(checkOutDate, false);
    else checkOutPicker.clear();
  } else checkOutPicker.clear();
}
