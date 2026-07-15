"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export type SelectableCardCategory = {
  id: string;
  title: string;
  items: { id: string; label: string }[];
};

type SelectableCardDisclosureListProps = {
  categories: SelectableCardCategory[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  disabled?: boolean;
  renderItemIcon: (id: string, active: boolean) => ReactNode;
  renderCategoryIcon: (categoryId: string) => ReactNode;
};

export function SelectableCardDisclosureList({
  categories,
  selectedIds,
  onToggle,
  disabled = false,
  renderItemIcon,
  renderCategoryIcon,
}: SelectableCardDisclosureListProps) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set());

  const toggleCategory = (categoryId: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  return (
    <div className="khata-amenity-disclosures">
      {categories.map((category) => {
        const open = openCategories.has(category.id);
        const activeCount = category.items.filter((item) => selectedIds.has(item.id)).length;

        return (
          <div key={category.id} className={`khata-amenity-disclosure${open ? " is-open" : ""}`}>
            <button
              type="button"
              className="khata-amenity-disclosure__summary"
              aria-expanded={open}
              onClick={() => toggleCategory(category.id)}
            >
              <span className="khata-amenity-disclosure__title">
                <span className="khata-amenity-disclosure__cat-icon" aria-hidden>
                  {renderCategoryIcon(category.id)}
                </span>
                {category.title}
              </span>
              <span className="khata-amenity-disclosure__meta">
                {activeCount > 0 ? (
                  <span className="khata-amenity-disclosure__count">{activeCount}</span>
                ) : null}
                <ChevronDown
                  className={`khata-amenity-disclosure__chevron h-4 w-4${open ? " is-open" : ""}`}
                  aria-hidden
                />
              </span>
            </button>
            <div className={`khata-amenity-disclosure__panel${open ? " is-open" : ""}`}>
              <div className="khata-amenity-disclosure__panel-inner">
                <div className="khata-amenity-disclosure__grid">
                  {category.items.map((item) => {
                    const active = selectedIds.has(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={disabled}
                        aria-pressed={active}
                        className={`khata-amenity-card${active ? " is-active" : ""}`}
                        onClick={() => onToggle(item.id)}
                      >
                        <span className="khata-amenity-card__icon" aria-hidden>
                          {renderItemIcon(item.id, active)}
                        </span>
                        <span className="khata-amenity-card__label">{item.label}</span>
                        <span className="khata-amenity-card__check" aria-hidden>
                          {active ? "✓" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
