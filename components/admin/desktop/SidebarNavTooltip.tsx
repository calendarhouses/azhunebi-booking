"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const TIP_DELAY_MS = 420;

type SidebarNavTooltipProps = {
  title: string;
  hint?: string;
  disabled?: boolean;
  children: (handlers: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
  }) => React.ReactNode;
};

export function SidebarNavTooltip({ title, hint, disabled, children }: SidebarNavTooltipProps) {
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
      setTip({ top: rect.top + rect.height / 2, left: rect.right + 14 });
    }, TIP_DELAY_MS);
  }, [disabled]);

  useEffect(() => () => hideTip(), [hideTip]);

  const handlers = {
    onMouseEnter: showTip,
    onMouseLeave: hideTip,
    onFocus: showTip,
    onBlur: hideTip,
  };

  return (
    <>
      <span ref={anchorRef} className="sidebar-nav-tooltip-anchor">
        {children(handlers)}
      </span>
      {tip && typeof document !== "undefined"
        ? createPortal(
            <div
              className="sidebar-nav-tip sidebar-nav-tip--portal"
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
