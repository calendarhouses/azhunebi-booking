"use client";

import { useEffect, useRef, useState } from "react";

export function useAnimatedMetric(
  target: number,
  duration = 800,
  currency = true,
  replayToken?: string | number
): string {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const prevReplayTokenRef = useRef<string | number | undefined>(replayToken);

  useEffect(() => {
    const replayChanged = prevReplayTokenRef.current !== replayToken;
    prevReplayTokenRef.current = replayToken;
    const from = replayChanged ? 0 : displayRef.current;
    const to = Math.round(target);
    const start = performance.now();

    const step = (timestamp: number) => {
      const progress = Math.min((timestamp - start) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(easeOut * (to - from) + from);
      displayRef.current = current;
      setDisplay(current);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        displayRef.current = to;
        setDisplay(to);
      }
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration, replayToken]);

  return display.toLocaleString("uk-UA") + (currency ? " грн" : "");
}
