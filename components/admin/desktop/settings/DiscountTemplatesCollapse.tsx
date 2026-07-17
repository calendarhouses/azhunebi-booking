"use client";

import type { ReactNode } from "react";

type DiscountTemplatesCollapseProps = {
  open: boolean;
  children: ReactNode;
};

export function DiscountTemplatesCollapse({ open, children }: DiscountTemplatesCollapseProps) {
  return (
    <div
      className={`discount-templates-collapse${open ? " is-open" : ""}`}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="discount-templates-collapse__panel">
        <div className="discount-templates-collapse__content">{children}</div>
      </div>
    </div>
  );
}
