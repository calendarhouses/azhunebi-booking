"use client";

import { useEffect, type MutableRefObject, type RefObject } from "react";

type DragGate = {
  active: boolean;
};

const AXIS_LOCK_PX = 6;

/**
 * Settings price/rules boards: horizontal scroll stays on the board,
 * vertical pans scroll the page (.main-content). Native pan-x chaining is
 * unreliable on Android/iOS when the board is an overflow-x scrollport.
 */
export function useMobileBoardPageScroll(options: {
  enabled: boolean;
  boardRef: RefObject<HTMLElement | null>;
  pageRef: MutableRefObject<HTMLElement | null>;
  dragRef: { current: DragGate };
}) {
  const { enabled, boardRef, pageRef, dragRef } = options;

  useEffect(() => {
    if (!enabled) return;
    const board = boardRef.current;
    const page =
      pageRef.current ??
      (typeof document !== "undefined"
        ? (document.querySelector(".main-content") as HTMLElement | null)
        : null);
    if (!board || !page) return;

    let startX = 0;
    let startY = 0;
    let originPageTop = 0;
    let axis: "none" | "x" | "y" = "none";

    const onStart = (e: TouchEvent) => {
      if (dragRef.current.active) {
        axis = "none";
        return;
      }
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      originPageTop = page.scrollTop;
      axis = "none";
    };

    const onMove = (e: TouchEvent) => {
      if (dragRef.current.active) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (axis === "none") {
        if (Math.hypot(dx, dy) < AXIS_LOCK_PX) return;
        axis = Math.abs(dy) >= Math.abs(dx) ? "y" : "x";
      }

      if (axis !== "y") return;

      page.scrollTop = originPageTop + (startY - t.clientY);
      if (e.cancelable) e.preventDefault();
    };

    const onEnd = () => {
      axis = "none";
    };

    board.addEventListener("touchstart", onStart, { passive: true });
    board.addEventListener("touchmove", onMove, { passive: false });
    board.addEventListener("touchend", onEnd);
    board.addEventListener("touchcancel", onEnd);

    return () => {
      board.removeEventListener("touchstart", onStart);
      board.removeEventListener("touchmove", onMove);
      board.removeEventListener("touchend", onEnd);
      board.removeEventListener("touchcancel", onEnd);
    };
  }, [boardRef, dragRef, enabled, pageRef]);
}
