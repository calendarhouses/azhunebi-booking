"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { INFINITE_YEARS_BACK } from "./timelineInfiniteRange";

const VIRTUAL_BUFFER_DAYS = 45;
const APPROX_TODAY_INDEX = Math.round(INFINITE_YEARS_BACK * 365.25);

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

function initialVirtualWindow(daysCount: number, cellWidth: number): TimelineVirtualWindow {
  if (daysCount <= 0 || cellWidth <= 0) {
    return { startIndex: 0, endIndex: 0, offsetPx: 0 };
  }
  const todayIndex = Math.min(daysCount - 1, Math.max(0, APPROX_TODAY_INDEX));
  const scrollLeft = Math.max(0, (todayIndex - 1) * cellWidth);
  return computeVirtualWindow(scrollLeft, 400, daysCount, cellWidth);
}

/** Virtual day window from DOM scroll. Never writes scrollLeft — callers jump scroll themselves. */
export function useTimelineVirtualWindow(
  scrollRef: RefObject<HTMLElement | null>,
  daysCount: number,
  cellWidth: number,
  enabled: boolean,
  pausedRef: RefObject<boolean>
): { window: TimelineVirtualWindow; scheduleRecompute: () => void; recomputeNow: () => void } {
  const [windowRange, setWindowRange] = useState<TimelineVirtualWindow>(() =>
    initialVirtualWindow(daysCount, cellWidth)
  );
  const rafRef = useRef<number | null>(null);

  const applyWindow = useCallback((next: TimelineVirtualWindow) => {
    setWindowRange((prev) => {
      if (prev.startIndex === next.startIndex && prev.endIndex === next.endIndex) return prev;
      return next;
    });
  }, []);

  const recomputeNow = useCallback(() => {
    if (!enabled || pausedRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    applyWindow(computeVirtualWindow(el.scrollLeft, el.clientWidth || 400, daysCount, cellWidth));
  }, [scrollRef, daysCount, cellWidth, enabled, pausedRef, applyWindow]);

  const scheduleRecompute = useCallback(() => {
    if (!enabled || pausedRef.current) return;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      recomputeNow();
    });
  }, [enabled, recomputeNow, pausedRef]);

  useEffect(() => {
    if (!enabled) return;
    recomputeNow();
  }, [enabled, recomputeNow, daysCount, cellWidth]);

  useEffect(() => {
    if (!enabled) return;
    const grid = scrollRef.current;
    if (!grid) return;

    const onScroll = () => scheduleRecompute();
    grid.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => scheduleRecompute());
    ro.observe(grid);

    return () => {
      grid.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, scrollRef, scheduleRecompute]);

  const window = useMemo(() => {
    if (!enabled) {
      return {
        startIndex: 0,
        endIndex: Math.max(0, daysCount - 1),
        offsetPx: 0,
      };
    }
    return windowRange;
  }, [enabled, daysCount, windowRange]);

  return { window, scheduleRecompute, recomputeNow };
}
