"use client";

import { useMemo } from "react";
import type { PublicRoom } from "@/lib/public-booking/types";
import { buildPublicRoomRulesByCategory, RuleCard } from "@/lib/public-booking/publicRoomRules";
import { PublicCategorizedCardsSection } from "./PublicCategorizedCardsSection";

export function PublicRoomRulesSection({ room }: { room: PublicRoom }) {
  const groups = useMemo(() => {
    return buildPublicRoomRulesByCategory(room).map((category) => ({
      id: category.id,
      title: category.title,
      items: category.cards.map((card) => (
        <RuleCard key={card.key} icon={card.icon} label={card.label} text={card.text} />
      )),
    }));
  }, [room]);

  return (
    <PublicCategorizedCardsSection
      sectionTitle="Правила"
      groups={groups}
      resetKey={room.id}
      listId="rulesList"
    />
  );
}
