"use client";

import { useEffect, useRef, useState } from "react";

const END_PX = 24;

function isAtScrollEnd(root: HTMLElement): boolean {
  if (root.scrollHeight <= root.clientHeight + END_PX) return true;
  return root.scrollHeight - root.scrollTop - root.clientHeight <= END_PX;
}

function isWindowAtScrollEnd(): boolean {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop;
  if (doc.scrollHeight <= window.innerHeight + END_PX) return true;
  return doc.scrollHeight - scrollTop - window.innerHeight <= END_PX;
}

type Options = {
  /** CSS selector for scroll root; falls back to `.drawer-content`, then window. */
  rootSelector?: string;
};

/**
 * Unlock after the guest scrolls rules to the bottom.
 * Stays unlocked if they scroll back up; resets when `active` becomes false.
 */
export function useStayRulesScrollUnlock(active: boolean, options?: Options) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (!active) {
      setUnlocked(false);
      return;
    }

    let cancelled = false;
    let root: HTMLElement | null = null;
    let useWindow = false;
    let resizeObserver: ResizeObserver | null = null;
    let raf = 0;

    const tryUnlock = () => {
      if (cancelled) return;
      if (useWindow) {
        if (isWindowAtScrollEnd()) setUnlocked(true);
        return;
      }
      if (!root) return;
      if (isAtScrollEnd(root)) setUnlocked(true);
    };

    const attach = () => {
      const sentinel = sentinelRef.current;
      if (!sentinel || cancelled) return;

      const selector = options?.rootSelector || ".drawer-content";
      root = sentinel.closest(selector) as HTMLElement | null;
      if (!root) {
        useWindow = true;
        tryUnlock();
        window.addEventListener("scroll", tryUnlock, { passive: true });
        window.addEventListener("resize", tryUnlock);
        return;
      }

      tryUnlock();
      root.addEventListener("scroll", tryUnlock, { passive: true });
      window.addEventListener("resize", tryUnlock);
      resizeObserver = new ResizeObserver(tryUnlock);
      resizeObserver.observe(root);
    };

    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(attach);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      root?.removeEventListener("scroll", tryUnlock);
      window.removeEventListener("scroll", tryUnlock);
      window.removeEventListener("resize", tryUnlock);
    };
  }, [active, options?.rootSelector]);

  return { sentinelRef, unlocked };
}
