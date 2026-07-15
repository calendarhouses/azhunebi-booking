"use client";

import { AMENITIES_CATEGORIES } from "@/constants/amenitiesDict";
import { AmenityCategoryIcon, AmenityIcon } from "@/constants/amenityIcons";
import { SelectableCardDisclosureList } from "./SelectableCardDisclosureList";

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
  return (
    <SelectableCardDisclosureList
      categories={AMENITIES_CATEGORIES}
      selectedIds={selectedIds}
      onToggle={onToggle}
      disabled={disabled}
      renderItemIcon={(id, active) => <AmenityIcon id={id} active={active} />}
      renderCategoryIcon={(categoryId) => <AmenityCategoryIcon categoryId={categoryId} />}
    />
  );
}
