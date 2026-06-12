"use client";

import flatpickr from "flatpickr";
import { Ukrainian } from "flatpickr/dist/l10n/uk.js";
import type { Instance } from "flatpickr/dist/types/instance";
import type { BaseOptions } from "flatpickr/dist/types/options";

import "flatpickr/dist/flatpickr.min.css";

flatpickr.localize(Ukrainian);

export type FlatpickrInstance = Instance;

/** Єдиний вхід для flatpickr в адмінці (npm, не window). */
export function createFlatpickr(
  element: string | HTMLElement,
  config: Partial<BaseOptions> = {}
): FlatpickrInstance {
  if (typeof element === "string") {
    return flatpickr(element, config) as FlatpickrInstance;
  }
  return flatpickr(element, config) as FlatpickrInstance;
}

export { flatpickr, Ukrainian };
