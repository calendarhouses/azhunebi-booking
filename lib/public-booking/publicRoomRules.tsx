import type { ReactNode } from "react";
import {
  HOUSE_RULES_CATEGORY_ID,
  LEGACY_RULE_ID_MAP,
  RULES_CATEGORIES,
} from "@/constants/rulesDict";
import type { PublicRoom } from "./types";
import { DesktopIcons } from "./desktopIcons";
import { PublicRuleIcon } from "./publicRuleIcon";

export type PublicRuleCard = {
  key: string;
  icon: ReactNode;
  label?: string;
  text: string;
};

function findRuleCategoryId(ruleId: string): string | undefined {
  return RULES_CATEGORIES.find((category) => category.items.some((entry) => entry.id === ruleId))?.id;
}

function findRuleLabel(ruleId: string): string | undefined {
  for (const category of RULES_CATEGORIES) {
    const item = category.items.find((entry) => entry.id === ruleId);
    if (item) return item.label;
  }
  return undefined;
}

export type PublicRuleCategoryBlock = {
  id: string;
  title: string;
  cards: PublicRuleCard[];
};

const RULE_CATEGORY_ORDER = ["checkin", "quiet", "smoking", "guests", "pets", "territory"];

export function buildPublicRoomRulesByCategory(room: PublicRoom): PublicRuleCategoryBlock[] {
  const categoryMap = new Map<string, PublicRuleCard[]>();
  const seenTexts = new Set<string>();
  const rules = room.rules;

  const pushCard = (categoryId: string, card: PublicRuleCard) => {
    const normalized = card.text.trim().toLowerCase();
    if (!normalized || seenTexts.has(normalized)) return;
    seenTexts.add(normalized);
    const bucket = categoryMap.get(categoryId) || [];
    bucket.push(card);
    categoryMap.set(categoryId, bucket);
  };

  if (rules?.checkInTime) {
    pushCard("checkin", {
      key: "check-in",
      icon: DesktopIcons.calendar,
      label: "Заселення",
      text: rules.checkInTime,
    });
  }

  if (rules?.checkOutTime) {
    pushCard("checkin", {
      key: "check-out",
      icon: (
        <svg viewBox="0 0 24 24">
          <path
            d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
            stroke="currentColor"
            fill="none"
            strokeWidth="1.5"
          />
        </svg>
      ),
      label: "Виселення",
      text: `до ${rules.checkOutTime}`,
    });
  }

  if (rules?.selfCheckIn?.enabled) {
    pushCard("checkin", {
      key: "legacy-self-check-in",
      icon: <PublicRuleIcon id="self_checkin" />,
      label: "Самостійне заселення",
      text: rules.selfCheckIn.description?.trim() || "Є інструкція для гостя",
    });
  }

  const houseRules = room.amenities?.[HOUSE_RULES_CATEGORY_ID] || [];
  for (const item of houseRules) {
    if (!item?.isActive) continue;
    const categoryId = findRuleCategoryId(item.id);
    if (!categoryId) continue;
    const label = findRuleLabel(item.id);
    const text = item.customText?.trim() || label || item.id;
    pushCard(categoryId, {
      key: `house-rule-${item.id}`,
      icon: <PublicRuleIcon id={item.id} />,
      text,
    });
  }

  const legacyRules = room.amenities?.rules || [];
  for (const item of legacyRules) {
    if (!item?.isActive) continue;
    const mappedId = LEGACY_RULE_ID_MAP[item.id] || item.id;
    const categoryId = findRuleCategoryId(mappedId);
    if (!categoryId) continue;
    const label = findRuleLabel(mappedId);
    const text = item.customText?.trim() || label || mappedId;
    pushCard(categoryId, {
      key: `legacy-rule-${item.id}`,
      icon: <PublicRuleIcon id={mappedId} />,
      text,
    });
  }

  return RULE_CATEGORY_ORDER.filter((id) => categoryMap.has(id)).map((id) => ({
    id,
    title: RULES_CATEGORIES.find((category) => category.id === id)?.title || id,
    cards: categoryMap.get(id) || [],
  }));
}

export function buildPublicRoomRules(room: PublicRoom): PublicRuleCard[] {
  return buildPublicRoomRulesByCategory(room).flatMap((block) => block.cards);
}

export function RuleCard({
  icon,
  label,
  text,
}: {
  icon: ReactNode;
  label?: string;
  text: string;
}) {
  return (
    <div className="rule-card">
      {icon}
      <div>
        {label ? <span>{label}</span> : null}
        {text}
      </div>
    </div>
  );
}
