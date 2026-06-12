"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AMENITIES_CATEGORIES } from "@/constants/amenitiesDict";
import { AmenityCategoryIcon, AmenityIcon } from "@/constants/amenityIcons";

type AmenityCategoryDisclosureListProps = {
  selectedIds: Set<string>;
  onToggle: (amenityId: string) => void;
  disabled?: boolean;
};

export function AmenityCategoryDisclosureList({
  selectedIds,
  onToggle,
  disabled = false,
}: AmenityCategoryDisclosureListProps) {
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
      {AMENITIES_CATEGORIES.map((category) => {
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
                  <AmenityCategoryIcon categoryId={category.id} />
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
                          <AmenityIcon id={item.id} active={active} />
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
