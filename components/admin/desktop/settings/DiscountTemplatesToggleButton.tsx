"use client";

import { X } from "lucide-react";
import type { AdminModalsApi } from "../useAdminModals";

type DiscountTemplatesToggleButtonProps = {
  modals: AdminModalsApi;
};

export function DiscountTemplatesToggleButton({ modals }: DiscountTemplatesToggleButtonProps) {
  const open = modals.discountTemplatesOpen;

  return (
    <button
      type="button"
      className={open ? "btn-secondary" : "btn-primary"}
      style={{ padding: "10px 16px", fontSize: 13 }}
      onClick={() => modals.toggleDiscountTemplates()}
    >
      {open ? (
        <>
          <X size={16} strokeWidth={2} aria-hidden />
          Закрити
        </>
      ) : (
        "+ Додати знижку"
      )}
    </button>
  );
}
