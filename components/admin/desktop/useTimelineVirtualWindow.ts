"use client";

import { useMemo } from "react";

const VIRTUAL_BUFFER_DAYS = 45;

export type TimelineVirtualWindow = {
  startIndex: number;
  endIndex: number;
  offsetPx: number;
};

export function computeVirtualWindow(
  scrollLeft: number,
  viewportWidth: number,
  daysCount: number,
  cellWidth: number
): TimelineVirtualWindow {
  if (daysCount <= 0 || cellWidth <= 0) {
    return { startIndex: 0, endIndex: 0, offsetPx: 0 };
  }

  const safeViewport = Math.max(viewportWidth, cellWidth * 4);
  const firstVisible = Math.floor(Math.max(0, scrollLeft) / cellWidth);
  const lastVisible = Math.ceil((Math.max(0, scrollLeft) + safeViewport) / cellWidth);
  const startIndex = Math.max(0, firstVisible - VIRTUAL_BUFFER_DAYS);
  const endIndex = Math.min(daysCount - 1, Math.max(startIndex, lastVisible + VIRTUAL_BUFFER_DAYS));

  return { startIndex, endIndex, offsetPx: startIndex * cellWidth };
}

/**
 * Virtual day window from an explicit scroll position (not raw DOM).
 * Avoids the empty board when scrollLeft is still 0 before layout finishes.
 */
export function useTimelineVirtualWindow(
  scrollLeft: number,
  viewportWidth: number,
  daysCount: number,
  cellWidth: number,
  enabled: boolean
): TimelineVirtualWindow {
  return useMemo(() => {
    if (!enabled) {
      return {
        startIndex: 0,
        endIndex: Math.max(0, daysCount - 1),
        offsetPx: 0,
      };
    }
    return computeVirtualWindow(scrollLeft, viewportWidth, daysCount, cellWidth);
  }, [scrollLeft, viewportWidth, daysCount, cellWidth, enabled]);
}
