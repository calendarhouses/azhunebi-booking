"use client";

import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { isDiscountDraftId } from "@/lib/admin/discountDraft";
import type { AdminModalsApi } from "../useAdminModals";
import type { DiscountConfig } from "../types";
import { getDiscountConditionSuffix, getDiscountDisplayName, getDiscountKindMeta, getDiscountListRowTitleName, getDiscountValueLabel, resolveDiscountActive } from "./discountConfig";

const DISCOUNT_ENABLED_BADGE_CLASS =
  "discount-status-badge discount-status-badge--on inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EAF0E4] text-olive-800 border border-solid border-olive-400 hover:bg-[#DFE9D6] hover:border-olive-600 hover:text-olive-900 cursor-pointer transition-colors text-xs font-semibold";

const DISCOUNT_DISABLED_BADGE_CLASS =
  "discount-status-badge discount-status-badge--off inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 text-stone-500 border border-solid border-stone-200 hover:bg-stone-200 hover:text-stone-600 cursor-pointer transition-colors text-xs font-semibold";

const editIcon = <Pencil size={14} strokeWidth={1.5} />;
const deleteIcon = <Trash2 size={14} strokeWidth={1.5} />;

function DiscountStatusBadge({ active }: { active: boolean }) {
  const className = active ? DISCOUNT_ENABLED_BADGE_CLASS : DISCOUNT_DISABLED_BADGE_CLASS;
  const dotClass = active ? "bg-olive-600" : "bg-stone-400";
  const label = active ? "Увімкнено" : "Вимкнено";

  return (
    <span className={className}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass} shrink-0`} aria-hidden />
      {label}
    </span>
  );
}

export function SettingsDiscountTableRow({
  discount,
  modals,
  isExpanded = false,
  onToggleExpand,
}: {
  discount: DiscountConfig;
  modals: AdminModalsApi;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const isDraft = isDiscountDraftId(discount.id);
  const displayName = getDiscountDisplayName(discount);
  const rowTitleName = getDiscountListRowTitleName(discount);
  const conditionSuffix = getDiscountConditionSuffix(discount);
  const kindMeta = getDiscountKindMeta(discount);
  const active = resolveDiscountActive(discount, isDraft);
  const valueLabel = getDiscountValueLabel(discount);

  const handleRowClick = () => {
    onToggleExpand?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDraft) {
      modals.discardDiscountDraft(discount.id);
      return;
    }
    modals.deleteGenericItem("discount", discount.id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand?.();
  };

  return (
    <tr
      id={`discount-row-${discount.id}`}
      className={`settings-discounts-row cursor-pointer${isExpanded ? " is-expanded" : ""}${isDraft ? " settings-discounts-row--draft" : ""}`}
      onClick={handleRowClick}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        handleRowClick();
      }}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
    >
      <td>
        <div className="settings-discounts-row__name-wrap">
          <div className="settings-discounts-row__name-inline">
            <strong
              className={`settings-discounts-row__name${!displayName || displayName === "Нова знижка" ? " settings-discounts-row__name--placeholder" : ""}`}
            >
              <span className="settings-discounts-row__name-primary">{rowTitleName}</span>
              {conditionSuffix ? (
                <>
                  <span className="settings-discounts-row__title-sep" aria-hidden>
                    ·
                  </span>
                  <span className="settings-discounts-row__name-condition">{conditionSuffix}</span>
                </>
              ) : null}
            </strong>
          </div>
          <div className="settings-discounts-row__meta">
            {valueLabel ? (
              <span className="settings-discounts-row__value">{valueLabel}</span>
            ) : null}
            <ChevronDown
              size={16}
              strokeWidth={2}
              className="settings-discounts-row__chevron"
              aria-hidden
            />
          </div>
        </div>
      </td>
      <td className="settings-discounts-row__type">
        <span className={kindMeta.badgeClass}>{kindMeta.label}</span>
      </td>
      <td className="settings-discounts-row__status" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="discount-status-toggle"
          disabled={isDraft}
          title={isDraft ? "Спочатку збережи нову знижку" : undefined}
          onClick={() => modals.toggleDiscountActive(discount.id)}
        >
          <DiscountStatusBadge active={active} />
        </button>
      </td>
      <td className="settings-discounts-row__actions" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-1">
          <button type="button" className="btn-icon-only" onClick={handleEdit} aria-label="Редагувати">
            {editIcon}
          </button>
          <button
            type="button"
            className="btn-icon-only danger"
            onClick={handleDelete}
            aria-label="Видалити"
          >
            {deleteIcon}
          </button>
        </div>
      </td>
    </tr>
  );
}
