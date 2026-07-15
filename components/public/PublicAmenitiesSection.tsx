"use client";

import { useMemo } from "react";
import type { PublicRoom } from "@/lib/public-booking/types";
import { buildPublicAmenities } from "@/lib/public-booking/desktopRoomContent";
import { RuleCard } from "@/lib/public-booking/publicRoomRules";
import { PublicCategorizedCardsSection } from "./PublicCategorizedCardsSection";

type PublicAmenitiesSectionProps = {
  room: PublicRoom;
  resetKey?: string | number;
};

export function PublicAmenitiesSection({ room, resetKey }: PublicAmenitiesSectionProps) {
  const groups = useMemo(() => {
    const { byCategory } = buildPublicAmenities(room);
    return byCategory.map((category) => ({
      id: category.id,
      title: category.title,
      items: category.items.map((item, index) => (
        <RuleCard
          key={`${category.id}-${index}-${item.label}`}
          icon={item.icon}
          text={item.label}
        />
      )),
    }));
  }, [room]);

  return (
    <PublicCategorizedCardsSection
      sectionTitle="Що включено"
      groups={groups}
      resetKey={resetKey}
      listId="amenitiesList"
    />
  );
}
