"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/** Базова ширина клітинки (як у legacy HTML). */
export const TIMELINE_CELL_BASE = 60;
export const TIMELINE_CELL_MIN = 60;
export const TIMELINE_CELL_MAX = 112;

export function resolveTimelineCellWidth(containerWidth: number, daysCount: number): number {
  if (containerWidth <= 0 || daysCount <= 0) return TIMELINE_CELL_BASE;
  const fitted = Math.floor(containerWidth / daysCount);
  if (fitted <= TIMELINE_CELL_MIN) return TIMELINE_CELL_MIN;
  return Math.min(TIMELINE_CELL_MAX, fitted);
}

/** Підлаштовує ширину дня під `.timeline-grid-container`, щоб сітка заповнювала екран. */
export function useTimelineCellWidth(
  containerRef: RefObject<HTMLElement | null>,
  daysCount: number,
  enabled = true
): number {
  const [cellWidth, setCellWidth] = useState(TIMELINE_CELL_BASE);

  useLayoutEffect(() => {
    if (!enabled) {
      setCellWidth(TIMELINE_CELL_BASE);
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      setCellWidth(resolveTimelineCellWidth(el.clientWidth, daysCount));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, daysCount, enabled]);

  return cellWidth;
}
