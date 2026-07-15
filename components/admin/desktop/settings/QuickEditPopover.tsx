"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

export const QUICK_EDIT_POPOVER_PANEL_CLASS =
  "fixed z-[3500] bg-white rounded-xl shadow-2xl shadow-stone-200/50 border border-stone-100 p-5 min-w-[240px] max-h-[calc(100vh-16px)] overflow-y-auto khata-quick-edit-popover";

export const QUICK_EDIT_POPOVER_PANEL_ABOVE_CLASS = "khata-quick-edit-popover--above";

export const QUICK_EDIT_POPOVER_TITLE_CLASS =
  "text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3";

export interface QuickEditPopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}

export function QuickEditPopover({ open, onClose, anchorRef, children }: QuickEditPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, placement: "below" as "below" | "above" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const panelWidth = panel?.offsetWidth ?? 240;
      const panelHeight = panel?.offsetHeight ?? 160;
      const gap = 8;
      const viewportPadding = 8;

      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;

      let placement: "below" | "above" = "below";
      let top = rect.bottom + gap;

      if (panelHeight + gap > spaceBelow && spaceAbove >= spaceBelow) {
        placement = "above";
        top = rect.top - panelHeight - gap;
      }

      const maxTop = window.innerHeight - panelHeight - viewportPadding;
      top = Math.max(viewportPadding, Math.min(top, maxTop));

      const maxLeft = Math.max(viewportPadding, window.innerWidth - panelWidth - viewportPadding);
      setPosition({
        top,
        left: Math.min(rect.left, maxLeft),
        placement,
      });
    };

    updatePosition();

    const resizeObserver =
      panelRef.current && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updatePosition())
        : null;
    resizeObserver?.observe(panelRef.current!);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, anchorRef, children]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={panelRef}
      className={`${QUICK_EDIT_POPOVER_PANEL_CLASS}${
        position.placement === "above" ? ` ${QUICK_EDIT_POPOVER_PANEL_ABOVE_CLASS}` : ""
      }`}
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-modal="false"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}
