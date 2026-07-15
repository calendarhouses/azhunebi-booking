"use client";

import { useEffect, useState, type CSSProperties, type RefObject } from "react";

/** Зсув треку в px — надійно працює з будь-якою кількістю слайдів. */
export function useSliderTrackStyle(
  viewportRef: RefObject<HTMLElement | null>,
  slideIndex: number
): CSSProperties {
  const [offsetPx, setOffsetPx] = useState(0);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const update = () => {
      setOffsetPx(slideIndex * el.clientWidth);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [viewportRef, slideIndex]);

  return { transform: `translateX(-${offsetPx}px)` };
}
