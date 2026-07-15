"use client";

import { RULES_CATEGORIES } from "@/constants/rulesDict";
import { RuleCategoryIcon, RuleIcon } from "@/constants/ruleIcons";
import { SelectableCardDisclosureList } from "./SelectableCardDisclosureList";

type RulesCategoryDisclosureListProps = {
  selectedIds: Set<string>;
  onToggle: (ruleId: string) => void;
  disabled?: boolean;
};

export function RulesCategoryDisclosureList({
  selectedIds,
  onToggle,
  disabled = false,
}: RulesCategoryDisclosureListProps) {
  return (
    <SelectableCardDisclosureList
      categories={RULES_CATEGORIES}
      selectedIds={selectedIds}
      onToggle={onToggle}
      disabled={disabled}
      renderItemIcon={(id, active) => <RuleIcon id={id} active={active} />}
      renderCategoryIcon={(categoryId) => <RuleCategoryIcon categoryId={categoryId} />}
    />
  );
}
