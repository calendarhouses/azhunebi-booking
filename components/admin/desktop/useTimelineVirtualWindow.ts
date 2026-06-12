"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";

const VIRTUAL_BUFFER_DAYS = 45;

export type TimelineVirtualWindow = {
  startIndex: number;
  endIndex: number;
  offsetPx: number;
};

function computeVirtualWindow(
  scrollLeft: number,
  viewportWidth: number,
  daysCount: number,
  cellWidth: number
): TimelineVirtualWindow {
  if (daysCount <= 0 || cellWidth <= 0) {
    return { startIndex: 0, endIndex: 0, offsetPx: 0 };
  }

  const firstVisible = Math.floor(scrollLeft / cellWidth);
  const lastVisible = Math.ceil((scrollLeft + viewportWidth) / cellWidth);
  const startIndex = Math.max(0, firstVisible - VIRTUAL_BUFFER_DAYS);
  const endIndex = Math.min(daysCount - 1, lastVisible + VIRTUAL_BUFFER_DAYS);

  return { startIndex, endIndex, offsetPx: startIndex * cellWidth };
}

/** Рендерить лише видимі (+ буфер) колонки днів у режимі безкінечної шкали. */
export function useTimelineVirtualWindow(
  scrollRef: RefObject<HTMLElement | null>,
  daysCount: number,
  cellWidth: number,
  enabled: boolean,
  pausedRef: RefObject<boolean>
): { window: TimelineVirtualWindow; scheduleRecompute: () => void } {
  const [windowRange, setWindowRange] = useState<TimelineVirtualWindow>(() => ({
    startIndex: 0,
    endIndex: Math.max(0, Math.min(daysCount - 1, 80)),
    offsetPx: 0,
  }));
  const rafRef = useRef<number | null>(null);

  const recompute = useCallback(() => {
    if (!enabled || pausedRef.current) return;

    const el = scrollRef.current;
    if (!el) return;

    const next = computeVirtualWindow(el.scrollLeft, el.clientWidth, daysCount, cellWidth);
    setWindowRange((prev) => {
      if (prev.startIndex === next.startIndex && prev.endIndex === next.endIndex) return prev;
      return next;
    });
  }, [scrollRef, daysCount, cellWidth, enabled, pausedRef]);

  const scheduleRecompute = useCallback(() => {
    if (!enabled || pausedRef.current) return;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      recompute();
    });
  }, [enabled, recompute, pausedRef]);

  useEffect(() => {
    if (!enabled) return;
    recompute();
  }, [enabled, recompute, daysCount, cellWidth]);

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

  return { window, scheduleRecompute };
}
