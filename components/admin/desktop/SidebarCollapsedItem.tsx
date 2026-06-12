"use client";

import { forwardRef } from "react";
import type { ReactNode } from "react";
import { SidebarNavTooltip } from "./SidebarNavTooltip";

type SidebarCollapsedItemProps = {
  label: string;
  hint?: string;
  active?: boolean;
  elementId?: string;
  onClick?: () => void;
  className?: string;
  showTooltip?: boolean;
  ariaExpanded?: boolean;
  children: ReactNode;
};

export const SidebarCollapsedItem = forwardRef<HTMLButtonElement, SidebarCollapsedItemProps>(
  function SidebarCollapsedItem(
    {
      label,
      hint,
      active = false,
      elementId,
      onClick,
      className = "",
      showTooltip = true,
      ariaExpanded,
      children,
    },
    ref
  ) {
    const itemClass = [
      "sidebar-collapsed-item",
      active ? "sidebar-collapsed-item--active" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const button = (
      <button
        ref={ref}
        type="button"
        id={elementId}
        className={itemClass}
        onClick={onClick}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        aria-expanded={ariaExpanded}
      >
        {active ? <span className="sidebar-collapsed-item__marker" aria-hidden /> : null}
        <span className="sidebar-collapsed-item__icon">{children}</span>
      </button>
    );

    if (!showTooltip) return button;

    return (
      <SidebarNavTooltip title={label} hint={hint}>
        {(handlers) => (
          <span className="sidebar-collapsed-item-wrap" {...handlers}>
            {button}
          </span>
        )}
      </SidebarNavTooltip>
    );
  }
);
