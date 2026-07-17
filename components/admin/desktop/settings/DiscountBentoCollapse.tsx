"use client";

import type { ReactNode } from "react";

type DiscountBentoCollapseProps = {
  open: boolean;
  children: ReactNode;
  className?: string;
};

/** Плавне розгортання/згортання (патерн grid 0fr → 1fr, як у «Твоє житло»). */
export function DiscountBentoCollapse({
  open,
  children,
  className = "",
}: DiscountBentoCollapseProps) {
  return (
    <div
      className={`discount-bento-collapse${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="discount-bento-collapse__panel">
        <div className="discount-bento-collapse__content">{children}</div>
      </div>
    </div>
  );
}
