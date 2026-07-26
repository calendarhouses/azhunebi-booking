"use client";

import { useCallback, useRef, type RefObject, type TouchEvent } from "react";

const SWIPE_THRESHOLD_PX = 48;
const MAX_VERTICAL_RATIO = 1.15;

/**
 * Horizontal swipe left/right to change calendar month.
 * Ignores mostly-vertical gestures so page scroll still works.
 */
export function useCalendarMonthSwipe(
  shiftCal: (dir: number) => void
): {
  swipeRef: RefObject<HTMLDivElement | null>;
  onTouchStart: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
} {
  const swipeRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 1) {
      startRef.current = null;
      return;
    }
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start || e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * MAX_VERTICAL_RATIO) return;
      // Swipe left → next month; swipe right → previous
      shiftCal(dx < 0 ? 1 : -1);
    },
    [shiftCal]
  );

  return { swipeRef, onTouchStart, onTouchEnd };
}
