"use client";

import { cloneElement, isValidElement, useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";

const TIP_DELAY_MS = 380;

type TimelineActionTooltipProps = {
  title: string;
  hint?: string;
  disabled?: boolean;
  children: ReactElement;
};

export function TimelineActionTooltip({ title, hint, disabled, children }: TimelineActionTooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null);

  const hideTip = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    setTip(null);
  }, []);

  const showTip = useCallback(() => {
    if (disabled) return;
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    showTimerRef.current = setTimeout(() => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setTip({
        top: rect.bottom + 10,
        left: rect.left + rect.width / 2,
      });
    }, TIP_DELAY_MS);
  }, [disabled]);

  useEffect(() => () => hideTip(), [hideTip]);

  const child = isValidElement(children)
    ? cloneElement(children, { title: undefined } as Record<string, unknown>)
    : children;

  return (
    <>
      <span
        ref={anchorRef}
        className="timeline-action-tooltip-anchor"
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        onFocus={showTip}
        onBlur={hideTip}
      >
        {child}
      </span>
      {tip && typeof document !== "undefined"
        ? createPortal(
            <div
              className="sidebar-nav-tip sidebar-nav-tip--portal sidebar-nav-tip--below"
              style={{ top: tip.top, left: tip.left }}
              role="tooltip"
            >
              <span className="sidebar-nav-tip__body">
                <span className="sidebar-nav-tip__title">{title}</span>
                {hint ? <span className="sidebar-nav-tip__hint">{hint}</span> : null}
              </span>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
